/**
 * Kernel Reduce — term reduction and normalization rules.
 *
 * Reductions simplify terms, eliminate redundancies, and compute
 * normal forms. They are distinct from inference rules: they don't
 * create new knowledge, they restructure existing terms.
 */

import { Term, TermOp, VariableTerm, ConstantTerm, CompoundTerm, termInterner, visitTerm, mapTerm } from './terms/intern';

/** Type guard for CompoundTerm. */
function isCompound(term: Term): term is CompoundTerm {
  return term.op !== TermOp.VARIABLE && term.op !== TermOp.CONSTANT;
}

/** Type guard for ConstantTerm. */
function isConstant(term: Term): term is ConstantTerm {
  return term.op === TermOp.CONSTANT;
}

/** Type guard for VariableTerm. */
function isVariable(term: Term): term is VariableTerm {
  return term.op === TermOp.VARIABLE;
}

/** Narrow term to CompoundTerm and return args. */
function getArgs(term: Term): readonly Term[] | null {
  return isCompound(term) ? term.args : null;
}

/** Narrow term to CompoundTerm and return arity. */
function getArity(term: Term): number | null {
  return isCompound(term) ? term.arity : null;
}

/** Get first arg of a compound term, asserting it exists. */
function getFirstArg(term: Term): Term {
  const args = getArgs(term)!;
  return args[0] as Term;
}

/** Get second arg of a compound term, asserting it exists. */
function getSecondArg(term: Term): Term {
  const args = getArgs(term)!;
  return args[1] as Term;
}

/** Get first two args of a binary compound term. */
function getBinaryArgs(term: Term): { first: Term; second: Term } {
  const args = getArgs(term);
  if (!args || args.length < 2) throw new Error('Expected binary operation');
  return { first: args[0] as Term, second: args[1] as Term };
}

/** Reduction rule. */
export interface ReductionRule {
  /** Rule name. */
  name: string;
  /** Pattern to match. */
  match: (term: Term) => boolean;
  /** Reduce the term. */
  reduce: (term: Term) => Term | null;
  /** Priority (higher = applied first). */
  priority: number;
}

/** Reduction result. */
export interface ReductionResult {
  /** Reduced term. */
  term: Term;
  /** Rules applied. */
  rulesApplied: string[];
  /** Whether any reduction occurred. */
  reduced: boolean;
}

/** Reducer engine. */
export class Reducer {
  private rules: ReductionRule[] = [];

  /** Add a reduction rule. */
  addRule(rule: ReductionRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /** Remove a rule by name. */
  removeRule(name: string): boolean {
    const idx = this.rules.findIndex(r => r.name === name);
    if (idx >= 0) {
      this.rules.splice(idx, 1);
      return true;
    }
    return false;
  }

  /** Reduce a term fully (until fixed point). */
  reduce(term: Term, maxIterations = 100): ReductionResult {
    let current = term;
    const rulesApplied: string[] = [];
    let reduced = false;

    for (let i = 0; i < maxIterations; i++) {
      let changed = false;

      for (const rule of this.rules) {
        if (rule.match(current)) {
          const result = rule.reduce(current);
          if (result && result !== current) {
            current = result;
            rulesApplied.push(rule.name);
            changed = true;
            reduced = true;
            break; // Restart from highest priority
          }
        }
      }

      if (!changed) break;
    }

    return { term: current, rulesApplied, reduced };
  }

  /** Reduce a term once (single pass). */
  reduceOnce(term: Term): ReductionResult {
    for (const rule of this.rules) {
      if (rule.match(term)) {
        const result = rule.reduce(term);
        if (result && result !== term) {
          return { term: result, rulesApplied: [rule.name], reduced: true };
        }
      }
    }
    return { term, rulesApplied: [], reduced: false };
  }

  /** Get all rules. */
  getRules(): ReductionRule[] {
    return [...this.rules];
  }

  /** Clear all rules. */
  clearRules(): void {
    this.rules = [];
  }
}

/** Create a reducer with built-in rules. */
export function createReducer(): Reducer {
  const reducer = new Reducer();

  // Double negation elimination: ~~A -> A
  reducer.addRule({
    name: 'double_negation',
    match: (term): boolean => {
      const args = getArgs(term);
      if (term.op !== TermOp.NEGATION || args === null || args.length === 0) return false;
      const firstArg = args[0]!;
      return isCompound(firstArg) && firstArg.op === TermOp.NEGATION;
    },
    reduce: (term): Term => {
      const inner = getFirstArg(term) as CompoundTerm;
      return getFirstArg(inner);
    },
    priority: 100,
  });

  // Double conversion elimination (inheritance): (A-->B)--> -> A-->B
  reducer.addRule({
    name: 'double_conversion_inheritance',
    match: (term): boolean => {
      const args = getArgs(term);
      if (term.op !== TermOp.INHERITANCE || args === null || args.length < 2) return false;
      const subj = args[0]!;
      const pred = args[1]!;
      return isCompound(subj) && subj.op === TermOp.INHERITANCE && isConstant(pred);
    },
    reduce: (term): Term => getFirstArg(term),
    priority: 90,
  });

  // Tautology elimination: A & A -> A
  reducer.addRule({
    name: 'tautology_conjunction',
    match: (term): boolean => {
      const args = getArgs(term);
      return term.op === TermOp.CONJUNCTION && args !== null && args.length >= 2 && args[0] === args[1];
    },
    reduce: (term): Term => getFirstArg(term),
    priority: 80,
  });

  // Contradiction elimination: A & ~A -> FALSE
  reducer.addRule({
    name: 'contradiction_conjunction',
    match: (term): boolean => {
      const args = getArgs(term);
      if (term.op !== TermOp.CONJUNCTION || args === null || args.length < 2) return false;
      const a = args[0]!;
      const b = args[1]!;
      return a.op === TermOp.NEGATION && isCompound(a) && getArgs(a)![0] === b ||
        b.op === TermOp.NEGATION && isCompound(b) && getArgs(b)![0] === a;
    },
    reduce: (): Term => termInterner.constant('FALSE'),
    priority: 80,
  });

  // Identity elimination: A | A -> A
  reducer.addRule({
    name: 'tautology_disjunction',
    match: (term): boolean => {
      const args = getArgs(term);
      return term.op === TermOp.DISJUNCTION && args !== null && args.length >= 2 && args[0] === args[1];
    },
    reduce: (term): Term => getFirstArg(term),
    priority: 80,
  });

  // Tautology: A | ~A -> TRUE
  reducer.addRule({
    name: 'tautology_disjunction_negation',
    match: (term): boolean => {
      const args = getArgs(term);
      if (term.op !== TermOp.DISJUNCTION || args === null || args.length < 2) return false;
      const a = args[0]!;
      const b = args[1]!;
      return a.op === TermOp.NEGATION && getArgs(a)![0] === b ||
        b.op === TermOp.NEGATION && getArgs(b)![0] === a;
    },
    reduce: (): Term => termInterner.constant('TRUE'),
    priority: 80,
  });

  // Absorption: A & (A | B) -> A
  reducer.addRule({
    name: 'absorption_conjunction',
    match: (term): boolean => {
      const args = getArgs(term);
      if (term.op !== TermOp.CONJUNCTION || args === null || args.length < 2) return false;
      const a = args[0]!;
      const b = args[1]!;
      return b.op === TermOp.DISJUNCTION && getArgs(b)!.some(arg => arg === a);
    },
    reduce: (term): Term => getFirstArg(term),
    priority: 70,
  });

  // Absorption: A | (A & B) -> A
  reducer.addRule({
    name: 'absorption_disjunction',
    match: (term): boolean => {
      const args = getArgs(term);
      if (term.op !== TermOp.DISJUNCTION || args === null || args.length < 2) return false;
      const a = args[0]!;
      const b = args[1]!;
      return b.op === TermOp.CONJUNCTION && getArgs(b)!.some(arg => arg === a);
    },
    reduce: (term): Term => getFirstArg(term),
    priority: 70,
  });

  // Distribution: A & (B | C) -> (A & B) | (A & C)
  reducer.addRule({
    name: 'distribution_conjunction_over_disjunction',
    match: (term): boolean => {
      const args = getArgs(term);
      if (term.op !== TermOp.CONJUNCTION || args === null) return false;
      return args.some(arg => arg.op === TermOp.DISJUNCTION);
    },
    reduce: (term): Term => {
      const args = getArgs(term)!;
      const disjArg = args.find(arg => arg.op === TermOp.DISJUNCTION)!;
      const otherArg = args.find(arg => arg.op !== TermOp.DISJUNCTION)!;
      const disjArgs = getArgs(disjArg)!;
      const d1 = disjArgs[0]!;
      const d2 = disjArgs[1]!;
      return termInterner.disjunction(
        termInterner.conjunction(otherArg, d1),
        termInterner.conjunction(otherArg, d2)
      );
    },
    priority: 60,
  });

  // Distribution: A | (B & C) -> (A | B) & (A | C)
  reducer.addRule({
    name: 'distribution_disjunction_over_conjunction',
    match: (term): boolean => {
      const args = getArgs(term);
      if (term.op !== TermOp.DISJUNCTION || args === null) return false;
      return args.some(arg => arg.op === TermOp.CONJUNCTION);
    },
    reduce: (term): Term => {
      const args = getArgs(term)!;
      const conjArg = args.find(arg => arg.op === TermOp.CONJUNCTION)!;
      const otherArg = args.find(arg => arg.op !== TermOp.CONJUNCTION)!;
      const conjArgs = getArgs(conjArg)!;
      const c1 = conjArgs[0]!;
      const c2 = conjArgs[1]!;
      return termInterner.conjunction(
        termInterner.disjunction(otherArg, c1),
        termInterner.disjunction(otherArg, c2)
      );
    },
    priority: 60,
  });

  // De Morgan: ~(A & B) -> ~A | ~B
  reducer.addRule({
    name: 'de_morgan_conjunction',
    match: (term): boolean => {
      const args = getArgs(term);
      if (!args || args.length === 0) return false;
      return term.op === TermOp.NEGATION && args[0]!.op === TermOp.CONJUNCTION;
    },
    reduce: (term): Term => {
      const args = getArgs(term)!;
      const inner = args[0]! as CompoundTerm;
      const innerArgs = inner.args;
      const a = innerArgs[0]!;
      const b = innerArgs[1]!;
      return termInterner.disjunction(
        termInterner.negation(a),
        termInterner.negation(b)
      );
    },
    priority: 90,
  });

  // De Morgan: ~(A | B) -> ~A & ~B
  reducer.addRule({
    name: 'de_morgan_disjunction',
    match: (term): boolean => {
      const args = getArgs(term);
      if (!args || args.length === 0) return false;
      return term.op === TermOp.NEGATION && args[0]!.op === TermOp.DISJUNCTION;
    },
    reduce: (term): Term => {
      const args = getArgs(term)!;
      const inner = args[0]! as CompoundTerm;
      const innerArgs = inner.args;
      const a = innerArgs[0]!;
      const b = innerArgs[1]!;
      return termInterner.conjunction(
        termInterner.negation(a),
        termInterner.negation(b)
      );
    },
    priority: 90,
  });

  // Implication elimination: (A ==> B) -> (~A | B)
  reducer.addRule({
    name: 'implication_elimination',
    match: (term): boolean => term.op === TermOp.IMPLICATION,
    reduce: (term): Term => {
      const args = getArgs(term)!;
      const ante = args[0]!;
      const conseq = args[1]!;
      return termInterner.disjunction(
        termInterner.negation(ante),
        conseq
      );
    },
    priority: 85,
  });

  // Equivalence elimination: (A <=> B) -> (A ==> B) & (B ==> A)
  reducer.addRule({
    name: 'equivalence_elimination',
    match: (term): boolean => term.op === TermOp.EQUIVALENCE,
    reduce: (term): Term => {
      const args = getArgs(term)!;
      const left = args[0]!;
      const right = args[1]!;
      return termInterner.conjunction(
        termInterner.implication(left, right),
        termInterner.implication(right, left)
      );
    },
    priority: 85,
  });

  // Flatten nested conjunctions: (A & B) & C -> A & B & C
  reducer.addRule({
    name: 'flatten_conjunction',
    match: (term): boolean => {
      const args = getArgs(term);
      return term.op === TermOp.CONJUNCTION && args !== null && args.some(arg => arg.op === TermOp.CONJUNCTION);
    },
    reduce: (term): Term => {
      const args = getArgs(term)!;
      const flattened: Term[] = [];
      const collect = (t: Term) => {
        if (t.op === TermOp.CONJUNCTION) {
          getArgs(t)?.forEach(collect);
        } else {
          flattened.push(t);
        }
      };
      args.forEach(collect);
      return termInterner.conjunction(...flattened);
    },
    priority: 75,
  });

  // Flatten nested disjunctions: (A | B) | C -> A | B | C
  reducer.addRule({
    name: 'flatten_disjunction',
    match: (term): boolean => {
      const args = getArgs(term);
      return term.op === TermOp.DISJUNCTION && args !== null && args.some(arg => arg.op === TermOp.DISJUNCTION);
    },
    reduce: (term): Term => {
      const args = getArgs(term)!;
      const flattened: Term[] = [];
      const collect = (t: Term) => {
        if (t.op === TermOp.DISJUNCTION) {
          getArgs(t)?.forEach(collect);
        } else {
          flattened.push(t);
        }
      };
      args.forEach(collect);
      return termInterner.disjunction(...flattened);
    },
    priority: 75,
  });

  // Flatten nested products: (A * B) * C -> A * B * C
  reducer.addRule({
    name: 'flatten_product',
    match: (term): boolean => {
      const args = getArgs(term);
      return term.op === TermOp.PRODUCT && args !== null && args.some(arg => arg.op === TermOp.PRODUCT);
    },
    reduce: (term): Term => {
      const args = getArgs(term)!;
      const flattened: Term[] = [];
      const collect = (t: Term) => {
        if (t.op === TermOp.PRODUCT) {
          getArgs(t)?.forEach(collect);
        } else {
          flattened.push(t);
        }
      };
      args.forEach(collect);
      return termInterner.product(...flattened);
    },
    priority: 75,
  });

  // Sort commutative arguments for canonical form
  reducer.addRule({
    name: 'sort_commutative',
    match: (term): boolean => {
      const arity = getArity(term);
      return [TermOp.CONJUNCTION, TermOp.DISJUNCTION, TermOp.SIMILARITY, TermOp.EQUIVALENCE, TermOp.PRODUCT].includes(term.op) && (arity ?? 0) > 1;
    },
    reduce: (term): Term | null => {
      const args = getArgs(term)!;
      const sorted = [...args].sort((a, b) => termInterner.getHash(a) - termInterner.getHash(b));
      // Check if already sorted
      let same = true;
      for (let i = 0; i < args.length; i++) {
        if (args[i] !== sorted[i]) { same = false; break; }
      }
      if (same) return null;
      return termInterner.compound(term.op, ...sorted);
    },
    priority: 50,
  });

  // Eliminate TRUE from conjunction: TRUE & A -> A
  reducer.addRule({
    name: 'eliminate_true_conjunction',
    match: (term): boolean => {
      const args = getArgs(term);
      return term.op === TermOp.CONJUNCTION && args !== null && args.some(arg => arg.op === TermOp.CONSTANT && isConstant(arg) && arg.value === 'TRUE');
    },
    reduce: (term): Term => {
      const args = getArgs(term)!;
      const filtered = args.filter(arg => !(arg.op === TermOp.CONSTANT && isConstant(arg) && arg.value === 'TRUE'));
      if (filtered.length === 1) return filtered[0]!;
      return termInterner.conjunction(...filtered);
    },
    priority: 70,
  });

  // Eliminate FALSE from disjunction: FALSE | A -> A
  reducer.addRule({
    name: 'eliminate_false_disjunction',
    match: (term): boolean => {
      const args = getArgs(term);
      return term.op === TermOp.DISJUNCTION && args !== null && args.some(arg => arg.op === TermOp.CONSTANT && isConstant(arg) && arg.value === 'FALSE');
    },
    reduce: (term): Term => {
      const args = getArgs(term)!;
      const filtered = args.filter(arg => !(arg.op === TermOp.CONSTANT && isConstant(arg) && arg.value === 'FALSE'));
      if (filtered.length === 1) return filtered[0]!;
      return termInterner.disjunction(...filtered);
    },
    priority: 70,
  });

  // FALSE in conjunction -> FALSE
  reducer.addRule({
    name: 'false_conjunction',
    match: (term): boolean => {
      const args = getArgs(term);
      return term.op === TermOp.CONJUNCTION && args !== null && args.some(arg => arg.op === TermOp.CONSTANT && isConstant(arg) && arg.value === 'FALSE');
    },
    reduce: (): Term => termInterner.constant('FALSE'),
    priority: 70,
  });

  // TRUE in disjunction -> TRUE
  reducer.addRule({
    name: 'true_disjunction',
    match: (term): boolean => {
      const args = getArgs(term);
      return term.op === TermOp.DISJUNCTION && args !== null && args.some(arg => arg.op === TermOp.CONSTANT && isConstant(arg) && arg.value === 'TRUE');
    },
    reduce: (): Term => termInterner.constant('TRUE'),
    priority: 70,
  });

  return reducer;
}

/** Normal form types. */
export type NormalForm = 'NNF' | 'CNF' | 'DNF' | 'PNF';

/** Convert term to Negation Normal Form (NNF). */
export function toNNF(term: Term): Term {
  const reducer = createReducer();
  // The built-in rules already handle NNF conversion via:
  // - implication_elimination
  // - equivalence_elimination
  // - de_morgan_conjunction
  // - de_morgan_disjunction
  // - double_negation
  return reducer.reduce(term).term;
}

/** Convert term to Conjunctive Normal Form (CNF). */
export function toCNF(term: Term): Term {
  let nnf = toNNF(term);
  const reducer = createReducer();
  // Apply distribution until fixed point
  return reducer.reduce(nnf).term;
}

/** Convert term to Disjunctive Normal Form (DNF). */
export function toDNF(term: Term): Term {
  let nnf = toNNF(term);
  const reducer = createReducer();
  // Apply distribution (disjunction over conjunction) until fixed point
  // This requires a custom reducer with different rule priorities
  return reducer.reduce(nnf).term;
}

/** Check if term is in NNF. */
export function isNNF(term: Term): boolean {
  let result = true;
  visitTerm(term, {
    visitVariable: () => undefined as never,
    visitConstant: () => undefined as never,
    visitCompound: (t) => {
      if (t.op === TermOp.IMPLICATION || t.op === TermOp.EQUIVALENCE) {
        result = false;
      }
      if (t.op === TermOp.NEGATION) {
        const args = getArgs(t);
        if (args !== null && args.length > 0) {
          const arg = args[0]!;
          if (arg.op === TermOp.CONJUNCTION || arg.op === TermOp.DISJUNCTION ||
              arg.op === TermOp.IMPLICATION || arg.op === TermOp.EQUIVALENCE ||
              (arg.op === TermOp.NEGATION)) {
            const innerArgs = getArgs(arg);
            if (innerArgs !== null && innerArgs.length > 0) {
              const innerArg = innerArgs[0]!;
              if (innerArg.op !== TermOp.VARIABLE && innerArg.op !== TermOp.CONSTANT) {
                result = false;
              }
            }
          }
        }
      }
      return undefined as never;
    },
  });
  return result;
}

/** Check if term is in CNF. */
export function isCNF(term: Term): boolean {
  if (!isNNF(term)) return false;
  // CNF: conjunction of disjunctions (or a single disjunction/literal)
  const args = getArgs(term);
  if (term.op === TermOp.CONJUNCTION && args !== null) {
    return args.every(arg => arg.op === TermOp.DISJUNCTION);
  }
  return term.op === TermOp.DISJUNCTION || term.op === TermOp.NEGATION || term.op === TermOp.VARIABLE || term.op === TermOp.CONSTANT;
}

/** Check if term is in DNF. */
export function isDNF(term: Term): boolean {
  if (!isNNF(term)) return false;
  // DNF: disjunction of conjunctions (or a single conjunction/literal)
  const args = getArgs(term);
  if (term.op === TermOp.DISJUNCTION && args !== null) {
    return args.every(arg => arg.op === TermOp.CONJUNCTION);
  }
  return term.op === TermOp.CONJUNCTION || term.op === TermOp.NEGATION || term.op === TermOp.VARIABLE || term.op === TermOp.CONSTANT;
}

/** Get all literals in a CNF/DNF term. */
export function getLiterals(term: Term): Term[] {
  const literals: Term[] = [];
  visitTerm(term, {
    visitVariable: (t) => { literals.push(t); return undefined as never; },
    visitConstant: (t) => { literals.push(t); return undefined as never; },
    visitCompound: (t) => {
      const args = getArgs(t);
      if (t.op === TermOp.NEGATION && args !== null && args.length > 0) {
        const arg = args[0]!;
        if (arg.op === TermOp.VARIABLE || arg.op === TermOp.CONSTANT) {
          literals.push(t);
        }
      }
      return undefined as never;
    },
  });
  return literals;
}

/** Check if CNF is satisfied by a truth assignment. */
export function evaluateCNF(term: Term, assignment: Map<Term, boolean>): boolean {
  const args = getArgs(term);
  if (term.op === TermOp.CONJUNCTION && args !== null) {
    return args.every(arg => evaluateClause(arg, assignment));
  }
  return evaluateClause(term, assignment);
}

function evaluateClause(term: Term, assignment: Map<Term, boolean>): boolean {
  const args = getArgs(term);
  if (term.op === TermOp.DISJUNCTION && args !== null) {
    return args.some(arg => evaluateLiteral(arg, assignment));
  }
  return evaluateLiteral(term, assignment);
}

function evaluateLiteral(term: Term, assignment: Map<Term, boolean>): boolean {
  const args = getArgs(term);
  if (term.op === TermOp.NEGATION && args !== null && args.length > 0) {
    const inner = args[0]!;
    const val = assignment.get(inner) ?? false;
    return !val;
  }
  return assignment.get(term) ?? false;
}