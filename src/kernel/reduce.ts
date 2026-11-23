/**
 * Kernel Reduce — term reduction and normalization rules.
 *
 * Reductions simplify terms, eliminate redundancies, and compute
 * normal forms. They are distinct from inference rules: they don't
 * create new knowledge, they restructure existing terms.
 */

import { Term, TermOp, VariableTerm, ConstantTerm, CompoundTerm, termInterner, visitTerm, mapTerm } from './terms/intern';
import { SenarsError } from '../errors/senars-error';

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
  if (!args || args.length < 2) throw new SenarsError('Expected binary operation', 'VALIDATION_ERROR', { term: term.toString(), argCount: args?.length ?? 0 });
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

  const rule = (name: string, priority: number, match: (term: Term) => boolean, reduce: (term: Term) => Term | null) =>
    reducer.addRule({ name, priority, match, reduce });

  // Double negation elimination: ~~A -> A
  rule('double_negation', 100,
    t => t.op === TermOp.NEGATION && (getArgs(t)?.[0]?.op === TermOp.NEGATION),
    t => getFirstArg(getFirstArg(t) as CompoundTerm));

  // Double conversion elimination (inheritance): (A-->B)--> -> A-->B
  rule('double_conversion_inheritance', 90,
    t => {
      const args = getArgs(t);
      return !!(t.op === TermOp.INHERITANCE && args && args.length >= 2 &&
        args[0]?.op === TermOp.INHERITANCE && isConstant(args[1]!));
    },
    t => getFirstArg(t));

  // Tautology elimination: A & A -> A
  rule('tautology_conjunction', 80,
    t => t.op === TermOp.CONJUNCTION && (getArgs(t)?.[0] === getArgs(t)?.[1]),
    t => getFirstArg(t));

  // Contradiction elimination: A & ~A -> FALSE
  rule('contradiction_conjunction', 80,
    t => {
      const args = getArgs(t);
      return !!(t.op === TermOp.CONJUNCTION && args && args.length >= 2 &&
        (args[0]?.op === TermOp.NEGATION && getArgs(args[0])?.[0] === args[1] ||
         args[1]?.op === TermOp.NEGATION && getArgs(args[1])?.[0] === args[0]));
    },
    () => termInterner.constant('FALSE'));

  // Identity elimination: A | A -> A
  rule('tautology_disjunction', 80,
    t => t.op === TermOp.DISJUNCTION && (getArgs(t)?.[0] === getArgs(t)?.[1]),
    t => getFirstArg(t));

  // Tautology: A | ~A -> TRUE
  rule('tautology_disjunction_negation', 80,
    t => {
      const args = getArgs(t);
      return !!(t.op === TermOp.DISJUNCTION && args && args.length >= 2 &&
        (args[0]?.op === TermOp.NEGATION && getArgs(args[0])?.[0] === args[1] ||
         args[1]?.op === TermOp.NEGATION && getArgs(args[1])?.[0] === args[0]));
    },
    () => termInterner.constant('TRUE'));

  // Absorption: A & (A | B) -> A
  rule('absorption_conjunction', 70,
    t => {
      const args = getArgs(t);
      return t.op === TermOp.CONJUNCTION && !!args && args.length >= 2 &&
        args[1]?.op === TermOp.DISJUNCTION && (getArgs(args[1]) ?? []).some(a => a === args[0]);
    },
    t => getFirstArg(t));

  // Absorption: A | (A & B) -> A
  rule('absorption_disjunction', 70,
    t => {
      const args = getArgs(t);
      return t.op === TermOp.DISJUNCTION && !!args && args.length >= 2 &&
        args[1]?.op === TermOp.CONJUNCTION && (getArgs(args[1]) ?? []).some(a => a === args[0]);
    },
    t => getFirstArg(t));

  // Distribution: A & (B | C) -> (A & B) | (A & C)
  rule('distribution_conjunction_over_disjunction', 60,
    t => t.op === TermOp.CONJUNCTION && (getArgs(t) ?? []).some(a => a.op === TermOp.DISJUNCTION),
    t => {
      const args = getArgs(t)!;
      const disjArg = args.find(a => a.op === TermOp.DISJUNCTION)!;
      const otherArg = args.find(a => a.op !== TermOp.DISJUNCTION)!;
      const disjArgs = getArgs(disjArg)!;
      const d1 = disjArgs[0]!;
      const d2 = disjArgs[1]!;
      return termInterner.disjunction(
        termInterner.conjunction(otherArg, d1),
        termInterner.conjunction(otherArg, d2)
      );
    });

  // Distribution: A | (B & C) -> (A | B) & (A | C)
  rule('distribution_disjunction_over_conjunction', 60,
    t => t.op === TermOp.DISJUNCTION && (getArgs(t) ?? []).some(a => a.op === TermOp.CONJUNCTION),
    t => {
      const args = getArgs(t)!;
      const conjArg = args.find(a => a.op === TermOp.CONJUNCTION)!;
      const otherArg = args.find(a => a.op !== TermOp.CONJUNCTION)!;
      const conjArgs = getArgs(conjArg)!;
      const c1 = conjArgs[0]!;
      const c2 = conjArgs[1]!;
      return termInterner.conjunction(
        termInterner.disjunction(otherArg, c1),
        termInterner.disjunction(otherArg, c2)
      );
    });

  // De Morgan: ~(A & B) -> ~A | ~B
  rule('de_morgan_conjunction', 90,
    t => t.op === TermOp.NEGATION && getArgs(t)?.[0]?.op === TermOp.CONJUNCTION,
    t => {
      const inner = getArgs(t)![0] as CompoundTerm;
      const args = getArgs(inner)!;
      const a = args[0]!;
      const b = args[1]!;
      return termInterner.disjunction(termInterner.negation(a), termInterner.negation(b));
    });

  // De Morgan: ~(A | B) -> ~A & ~B
  rule('de_morgan_disjunction', 90,
    t => t.op === TermOp.NEGATION && getArgs(t)?.[0]?.op === TermOp.DISJUNCTION,
    t => {
      const inner = getArgs(t)![0] as CompoundTerm;
      const args = getArgs(inner)!;
      const a = args[0]!;
      const b = args[1]!;
      return termInterner.conjunction(termInterner.negation(a), termInterner.negation(b));
    });

  // Implication elimination: (A ==> B) -> (~A | B)
  rule('implication_elimination', 85,
    t => t.op === TermOp.IMPLICATION,
    t => {
      const args = getArgs(t)!;
      const ante = args[0]!;
      const conseq = args[1]!;
      return termInterner.disjunction(termInterner.negation(ante), conseq);
    });

  // Equivalence elimination: (A <=> B) -> (A ==> B) & (B ==> A)
  rule('equivalence_elimination', 85,
    t => t.op === TermOp.EQUIVALENCE,
    t => {
      const args = getArgs(t)!;
      const left = args[0]!;
      const right = args[1]!;
      return termInterner.conjunction(
        termInterner.implication(left, right),
        termInterner.implication(right, left)
      );
    });

  // Flatten nested: (A op B) op C -> A op B op C
  const flatten = (op: TermOp, name: string, priority: number) =>
    rule(`flatten_${name}`, priority,
      t => t.op === op && (getArgs(t) ?? []).some(a => a.op === op),
      t => {
        const flattened: Term[] = [];
        const collect = (x: Term) => x.op === op ? (getArgs(x) ?? []).forEach(collect) : flattened.push(x);
        (getArgs(t) ?? []).forEach(collect);
        return termInterner.compound(op, ...flattened);
      });

  flatten(TermOp.CONJUNCTION, 'conjunction', 75);
  flatten(TermOp.DISJUNCTION, 'disjunction', 75);
  flatten(TermOp.PRODUCT, 'product', 75);

  // Sort commutative arguments for canonical form
  rule('sort_commutative', 50,
    t => [TermOp.CONJUNCTION, TermOp.DISJUNCTION, TermOp.SIMILARITY, TermOp.EQUIVALENCE, TermOp.PRODUCT].includes(t.op) && (getArity(t) ?? 0) > 1,
    t => {
      const args = getArgs(t)!;
      const sorted = [...args].sort((a, b) => termInterner.getHash(a) - termInterner.getHash(b));
      return args.every((a, i) => a === sorted[i]) ? null : termInterner.compound(t.op, ...sorted);
    });

  // Eliminate TRUE/FALSE
  const elim = (op: TermOp, opName: string, value: 'TRUE' | 'FALSE', priority: number) =>
    rule(`eliminate_${value.toLowerCase()}_${opName}`, priority,
      t => t.op === op && (getArgs(t) ?? []).some(a => a.op === TermOp.CONSTANT && isConstant(a) && a.value === value),
      t => {
        const args = getArgs(t)!;
        const filtered = args.filter(a => !(a.op === TermOp.CONSTANT && isConstant(a) && a.value === value));
        return filtered.length === 1 ? filtered[0]! : termInterner.compound(op, ...filtered);
      });

  elim(TermOp.CONJUNCTION, 'conjunction', 'TRUE', 70);
  elim(TermOp.DISJUNCTION, 'disjunction', 'FALSE', 70);

  // FALSE in conjunction -> FALSE
  rule('false_conjunction', 70,
    t => t.op === TermOp.CONJUNCTION && (getArgs(t) ?? []).some(a => a.op === TermOp.CONSTANT && isConstant(a) && a.value === 'FALSE'),
    () => termInterner.constant('FALSE'));

  // TRUE in disjunction -> TRUE
  rule('true_disjunction', 70,
    t => t.op === TermOp.DISJUNCTION && (getArgs(t) ?? []).some(a => a.op === TermOp.CONSTANT && isConstant(a) && a.value === 'TRUE'),
    () => termInterner.constant('TRUE'));

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