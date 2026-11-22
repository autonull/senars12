/**
 * SLD Resolution — synchronous floor for axiomatic reasoning.
 *
 * Implements SLD (Selective Linear Definite) resolution for Horn clauses.
 * This is the deterministic, synchronous inference engine for the axiomatic module.
 */

import { Term, VariableTerm, TermOp, termInterner, CompoundTerm, ConstantTerm } from '../../kernel/terms/intern';
import {
  Atom,
  Clause,
  Literal,
  Formula,
  SLDStep,
  MGU,
  isAtom,
  freeVariables,
  clause,
  literal,
} from './ast';

/** SLD engine configuration. */
export interface SLDConfig {
  /** Maximum derivation depth. */
  maxDepth: number;
  /** Maximum number of solutions. */
  maxSolutions: number;
  /** Enable tabling/memoization. */
  enableTabling: boolean;
}

/** Default SLD configuration. */
export const defaultSLDConfig: SLDConfig = {
  maxDepth: 100,
  maxSolutions: 1000,
  enableTabling: true,
};

/** Substitution (variable -> term mapping). */
export type Substitution = Map<VariableTerm, Term>;

/** SLD engine state. */
export interface SLDState {
  readonly goals: readonly Atom[];
  readonly substitution: Substitution;
  readonly depth: number;
  readonly path: readonly SLDStep[];
}

/** SLD query result. */
export interface SLDResult {
  readonly success: boolean;
  readonly substitution?: Substitution;
  readonly steps?: readonly SLDStep[];
  readonly remainingGoals?: readonly Atom[];
  readonly error?: string;
}

/** SLD resolution engine. */
export class SLDResolver {
  private clauses: Clause[];
  private config: SLDConfig;
  private table: Map<string, SLDResult[]>; // For tabling

  constructor(clauses: Clause[], config: Partial<SLDConfig> = {}) {
    this.clauses = clauses;
    this.config = { ...defaultSLDConfig, ...config };
    this.table = new Map();
  }

  /** Add a clause to the program. */
  addClause(clause: Clause): void {
    this.clauses.push(clause);
    this.table.clear(); // Invalidate table
  }

  /** Get all clauses. */
  getClauses(): Clause[] {
    return [...this.clauses];
  }

  /** Resolve a query (conjunction of atoms). */
  resolve(goals: readonly Atom[]): SLDResult {
    const initialState: SLDState = {
      goals: [...goals],
      substitution: new Map(),
      depth: 0,
      path: [],
    };

    const results = this.sldResolve(initialState);
    return results[0] ?? { success: false, error: 'No derivation found' };
  }

  /** Get all solutions up to maxSolutions. */
  resolveAll(goals: readonly Atom[]): SLDResult[] {
    const initialState: SLDState = {
      goals: [...goals],
      substitution: new Map(),
      depth: 0,
      path: [],
    };

    return this.sldResolve(initialState);
  }

  /** Core SLD resolution algorithm. */
  private sldResolve(state: SLDState): SLDResult[] {
    // Check depth limit
    if (state.depth > this.config.maxDepth) {
      return [{ success: false, error: 'Max depth exceeded' }];
    }

    // Check solution limit
    if (this.config.maxSolutions > 0 && state.path.length >= this.config.maxSolutions) {
      return [{ success: false, error: 'Max solutions reached' }];
    }

    // Success: no more goals
    if (state.goals.length === 0) {
      return [{ success: true, substitution: state.substitution, steps: state.path }];
    }

    // Select leftmost goal (SLD selection rule)
    const selectedGoal = state.goals[0];
    if (!selectedGoal) return [{ success: false, error: 'No goals to resolve' }];
    const remainingGoals = state.goals.slice(1);

    // Find applicable clauses
    const applicableClauses = this.findApplicableClauses(selectedGoal);
    if (applicableClauses.length === 0) {
      return [{ success: false, error: `No clause matches ${selectedGoal.predicate}` }];
    }

    const results: SLDResult[] = [];

    for (const clause of applicableClauses) {
      // Try to unify selected goal with clause head
      const headLiteral = clause.literals[0];
      if (!headLiteral || !headLiteral.sign) continue; // Head must be positive

      const mgu = this.unify(selectedGoal, headLiteral.atom);
      if (!mgu) continue;

      // Apply MGU to clause body and remaining goals
      const newBody = this.applySubstitution(clause.literals.slice(1).map(l => l.atom), mgu.substitution);
      const newRemainingGoals = this.applySubstitution(remainingGoals, mgu.substitution);

      // Build new goal list: body literals + remaining goals
      const newGoals = [...newBody, ...newRemainingGoals];

      // Compose substitutions
      const newSubstitution = this.composeSubstitutions(state.substitution, mgu.substitution);

      // Record step
      const step: SLDStep = {
        goal: state.goals,
        clause,
        mgu,
        newGoal: newGoals,
      };

      // Recurse
      const newState: SLDState = {
        goals: newGoals,
        substitution: newSubstitution,
        depth: state.depth + 1,
        path: [...state.path, step],
      };

      const subResults = this.sldResolve(newState);
      results.push(...subResults);

      // Check solution limit
      if (this.config.maxSolutions > 0 && results.length >= this.config.maxSolutions) {
        break;
      }
    }

    return results;
  }

  /** Find clauses whose head unifies with the goal. */
  private findApplicableClauses(goal: Atom): Clause[] {
    return this.clauses.filter(clause => {
      const head = clause.literals[0];
      return head && head.sign && head.atom.predicate === goal.predicate && head.atom.args.length === goal.args.length;
    });
  }

  /** Unify two atoms. Returns MGU or null if not unifiable. */
  private unify(goal: Atom, head: Atom): MGU | null {
    if (goal.predicate !== head.predicate || goal.args.length !== head.args.length) {
      return null;
    }

    const substitution = new Map<VariableTerm, Term>();
    const visited = new Set<VariableTerm>();

    for (let i = 0; i < goal.args.length; i++) {
      const g = goal.args[i]!;
      const h = head.args[i]!;

      const mgu = this.unifyTerms(g, h, substitution, visited);
      if (!mgu) return null;
    }

    return { substitution, isIdentity: substitution.size === 0 };
  }

  /** Check if term is compound (not variable, not constant). */
  private isCompoundTerm(term: Term): term is CompoundTerm {
    return term.op !== TermOp.VARIABLE && term.op !== TermOp.CONSTANT;
  }

  /** Unify two terms with current substitution. */
  private unifyTerms(
    t1: Term,
    t2: Term,
    substitution: Substitution,
    visited: Set<VariableTerm>
  ): Substitution | null {
    // Apply existing substitution
    t1 = this.applySubstitutionToTerm(t1, substitution);
    t2 = this.applySubstitutionToTerm(t2, substitution);

    // If identical, success
    if (t1 === t2) return substitution;

    // Variable unification
    if (t1.op === TermOp.VARIABLE) {
      const v1 = t1 as VariableTerm;
      if (visited.has(v1)) return null; // Occurs check
      visited.add(v1);

      if (this.occursCheck(v1, t2, substitution)) return null;

      substitution.set(v1, t2);
      return substitution;
    }

    if (t2.op === TermOp.VARIABLE) {
      const v2 = t2 as VariableTerm;
      if (visited.has(v2)) return null;
      visited.add(v2);

      if (this.occursCheck(v2, t1, substitution)) return null;

      substitution.set(v2, t1);
      return substitution;
    }

    // Both constants - must be equal
    if (t1.op === TermOp.CONSTANT && t2.op === TermOp.CONSTANT) {
      return t1 === t2 ? substitution : null;
    }

    // Both compound - unify arguments
    if (this.isCompoundTerm(t1) && this.isCompoundTerm(t2)) {
      const c1 = t1;
      const c2 = t2;

      if (c1.op !== c2.op || c1.arity !== c2.arity) return null;

      for (let i = 0; i < c1.arity; i++) {
        const result = this.unifyTerms(c1.args[i]!, c2.args[i]!, substitution, visited);
        if (!result) return null;
      }
      return substitution;
    }

    return null;
  }

  /** Occurs check: does variable v occur in term t? */
  private occursCheck(v: VariableTerm, t: Term, substitution: Substitution): boolean {
    t = this.applySubstitutionToTerm(t, substitution);

    if (t === v) return true;
    if (t.op === TermOp.VARIABLE) return false;
    if (t.op === TermOp.CONSTANT) return false;

    const ct = t as CompoundTerm;
    return ct.args.some(arg => this.occursCheck(v, arg, substitution));
  }

  /** Apply substitution to a term. */
  private applySubstitutionToTerm(term: Term, substitution: Substitution): Term {
    if (term.op === TermOp.VARIABLE) {
      return substitution.get(term as VariableTerm) ?? term;
    }
    if (term.op === TermOp.CONSTANT) return term;

    const ct = term as CompoundTerm;
    const newArgs = ct.args.map(arg => this.applySubstitutionToTerm(arg, substitution));

    if (newArgs.every((arg, i) => arg === ct.args[i])) return term;

    return termInterner.compound(ct.op, ...newArgs);
  }

  /** Apply substitution to array of atoms. */
  private applySubstitution(atoms: readonly Atom[], substitution: Substitution): Atom[] {
    return atoms.map(atom => ({
      ...atom,
      args: atom.args.map(arg => this.applySubstitutionToTerm(arg, substitution)),
    }));
  }

  /** Compose two substitutions (s2 after s1). */
  private composeSubstitutions(s1: Substitution, s2: Substitution): Substitution {
    const result = new Map<VariableTerm, Term>(s1);

    for (const [v, t] of s2) {
      const existing = result.get(v);
      if (existing) {
        // Apply s1 to t, then unify with existing
        const applied = this.applySubstitutionToTerm(t, s1);
        const mgu = this.unifyTerms(existing, applied, new Map(), new Set());
        if (mgu && mgu.has(v)) {
          result.set(v, mgu.get(v)!);
        }
      } else {
        result.set(v, this.applySubstitutionToTerm(t, s1));
      }
    }

    return result;
  }

  /** Format substitution for display. */
  formatSubstitution(sub: Substitution): string {
    const entries = Array.from(sub.entries())
      .map(([v, t]) => `${v.name} = ${this.termToString(t)}`)
      .join(', ');
    return entries || '{}';
  }

  private termToString(term: Term): string {
    if (term.op === TermOp.VARIABLE) return term.name;
    if (term.op === TermOp.CONSTANT) return (term as ConstantTerm).value;
    const ct = term as CompoundTerm;
    return `${ct.op}(${ct.args.map(this.termToString).join(', ')})`;
  }
}

/** Create an SLD resolver from Horn clauses. */
export function createSLDResolver(clauses: Clause[], config?: Partial<SLDConfig>): SLDResolver {
  return new SLDResolver(clauses, config);
}

/** Parse a simple rule string into a clause. */
export function parseRule(rule: string): Clause | null {
  // Simple parser for rules like "p(X) :- q(X), r(X)."
  // This is a placeholder - real implementation would be more robust
  const match = /^(\w+)\(([^)]*)\)\s*:-\s*([^.]+)\./.exec(rule.trim());
  if (!match) return null;

  const headPred = match[1]!;
  const headArgs = match[2]!;
  const bodyStr = match[3]!;

  const headAtom: Atom = {
    predicate: headPred,
    args: headArgs.split(',').map(s => termInterner.constant(s.trim())),
    negated: false,
  };

  const bodyLiterals: Literal[] = bodyStr.split(',').map(s => {
    const trimmed = s.trim();
    const negated = trimmed.startsWith('~');
    const pred = negated ? trimmed.slice(1) : trimmed;
    const predMatch = /^(\w+)\(([^)]*)\)$/.exec(pred);
    if (!predMatch) throw new Error(`Invalid literal: ${trimmed}`);
    const p = predMatch[1]!;
    const args = predMatch[2]!;
    return {
      atom: {
        predicate: p,
        args: args.split(',').map(a => termInterner.constant(a.trim())),
        negated: false,
      },
      sign: !negated,
    };
  });

  return clause(literal(headAtom, true), ...bodyLiterals);
}