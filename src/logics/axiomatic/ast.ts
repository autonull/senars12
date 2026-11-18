/**
 * Axiomatic Logic AST — formula representation for SLD/SMT/ASP engines.
 *
 * This module defines the abstract syntax tree for first-order formulas
 * with support for classical and non-classical logics.
 */

import { Term, TermOp, VariableTerm, ConstantTerm, CompoundTerm } from '../../kernel/terms/intern.js';

/** Logical connectives. */
export enum Connective {
  AND = '&',
  OR = '|',
  NOT = '~',
  IMPLIES = '==>',
  IFF = '<=>',
  FORALL = '∀',
  EXISTS = '∃',
}

/** Atomic formula (predicate application). */
export interface Atom {
  readonly predicate: string;
  readonly args: readonly Term[];
  readonly negated: boolean;
}

/** Quantified formula. */
export interface QuantifiedFormula {
  readonly quantifier: Connective.FORALL | Connective.EXISTS;
  readonly variables: readonly VariableTerm[];
  readonly body: Formula;
}

/** Compound formula. */
export interface CompoundFormula {
  readonly connective: Exclude<Connective, Connective.FORALL | Connective.EXISTS>;
  readonly left?: Formula;
  readonly right?: Formula;
  readonly operand?: Formula; // For NOT
}

/** Any formula. */
export type Formula = Atom | QuantifiedFormula | CompoundFormula;

/** Clause (disjunction of literals) for CNF. */
export interface Clause {
  readonly literals: readonly Literal[];
}

/** Literal (atom or negated atom). */
export interface Literal {
  readonly atom: Atom;
  readonly sign: boolean; // true = positive, false = negative
}

/** CNF formula (conjunction of clauses). */
export interface CNFFormula {
  readonly clauses: readonly Clause[];
}

/** Model (interpretation). */
export interface Model {
  readonly domain: readonly ConstantTerm[];
  readonly interpretation: Map<string, Set<string[]>>; // predicate -> tuples
}

/** Proof certificate. */
export interface ProofCertificate {
  readonly theorem: Formula;
  readonly proof: ProofStep[];
  readonly engine: string;
  readonly timestamp: number;
  readonly verified: boolean;
}

/** Proof step. */
export interface ProofStep {
  readonly rule: string;
  readonly premises: readonly Formula[];
  readonly conclusion: Formula;
  readonly justification?: string;
}

/** MUS (Minimal Unsatisfiable Subset). */
export interface MUS {
  readonly clauses: readonly Clause[];
  readonly formula: CNFFormula;
}

/** Symmetry group. */
export interface SymmetryGroup {
  readonly permutations: readonly Permutation[];
  readonly generators: readonly Permutation[];
}

/** Permutation of variables/constants. */
export interface Permutation {
  readonly mapping: Map<Term, Term>;
  readonly order: number;
}

/** Engine type. */
export type EngineType = 'sld' | 'smt' | 'asp' | 'prolog';

/** Engine configuration. */
export interface EngineConfig {
  readonly type: EngineType;
  readonly timeoutMs?: number;
  readonly maxModels?: number;
  readonly options?: Record<string, unknown>;
}

/** Query result. */
export interface QueryResult {
  readonly satisfiable: boolean;
  readonly models?: readonly Model[];
  readonly mus?: MUS;
  readonly proof?: ProofCertificate;
  readonly statistics: QueryStatistics;
}

/** Query statistics. */
export interface QueryStatistics {
  readonly timeMs: number;
  readonly nodesVisited: number;
  readonly clausesGenerated: number;
  readonly backtracks: number;
}

/** SLD derivation step. */
export interface SLDStep {
  readonly goal: readonly Atom[];
  readonly clause: Clause;
  readonly mgu: MGU; // Most General Unifier
  readonly newGoal: readonly Atom[];
}

/** Most General Unifier. */
export interface MGU {
  readonly substitution: Map<VariableTerm, Term>;
  readonly isIdentity: boolean;
}

/** Create an atom. */
export function atom(predicate: string, args: readonly Term[], negated = false): Atom {
  return { predicate, args, negated };
}

/** Create a conjunction. */
export function and(...formulas: Formula[]): Formula {
  if (formulas.length === 0) return atom('true', [], false);
  if (formulas.length === 1) return formulas[0]!;
  return formulas.reduce((acc, f) => ({ connective: Connective.AND, left: acc, right: f }));
}

/** Create a disjunction. */
export function or(...formulas: Formula[]): Formula {
  if (formulas.length === 0) return atom('false', [], false);
  if (formulas.length === 1) return formulas[0]!;
  return formulas.reduce((acc, f) => ({ connective: Connective.OR, left: acc, right: f }));
}

/** Create a negation. */
export function not(formula: Formula): Formula {
  if (isAtom(formula)) {
    return { ...formula, negated: !formula.negated };
  }
  return { connective: Connective.NOT, operand: formula };
}

/** Create an implication. */
export function implies(left: Formula, right: Formula): Formula {
  return { connective: Connective.IMPLIES, left, right };
}

/** Create an equivalence. */
export function iff(left: Formula, right: Formula): Formula {
  return { connective: Connective.IFF, left, right };
}

/** Create universal quantification. */
export function forall(variables: readonly VariableTerm[], body: Formula): Formula {
  return { quantifier: Connective.FORALL, variables, body };
}

/** Create existential quantification. */
export function exists(variables: readonly VariableTerm[], body: Formula): Formula {
  return { quantifier: Connective.EXISTS, variables, body };
}

/** Check if formula is an atom. */
export function isAtom(formula: Formula): formula is Atom {
  return 'predicate' in formula;
}

/** Check if formula is quantified. */
export function isQuantified(formula: Formula): formula is QuantifiedFormula {
  return 'quantifier' in formula;
}

/** Check if formula is compound. */
export function isCompound(formula: Formula): formula is CompoundFormula {
  return 'connective' in formula;
}

/** Get free variables in a formula. */
export function freeVariables(formula: Formula): Set<VariableTerm> {
  const result = new Set<VariableTerm>();

  function collect(f: Formula): void {
    if (isAtom(f)) {
      for (const arg of f.args) {
        if (arg.op === TermOp.VARIABLE) {
          result.add(arg);
        }
      }
    } else if (isQuantified(f)) {
      const bound = new Set(f.variables);
      collect(f.body);
      for (const v of bound) {
        result.delete(v);
      }
    } else if (isCompound(f)) {
      if (f.left) collect(f.left);
      if (f.right) collect(f.right);
      if (f.operand) collect(f.operand);
    }
  }

  collect(formula);
  return result;
}

/** Convert formula to string. */
export function formulaToString(formula: Formula): string {
  if (isAtom(formula)) {
    const prefix = formula.negated ? '~' : '';
    const args = formula.args.map(t => termToString(t)).join(', ');
    return `${prefix}${formula.predicate}(${args})`;
  }
  if (isQuantified(formula)) {
    const vars = formula.variables.map(v => v.name).join(', ');
    const sym = formula.quantifier === Connective.FORALL ? '∀' : '∃';
    return `${sym}${vars}. ${formulaToString(formula.body)}`;
  }
  if (formula.connective === Connective.NOT) {
    return `~${formulaToString(formula.operand!)}`;
  }
  const left = formula.left ? formulaToString(formula.left) : '';
  const right = formula.right ? formulaToString(formula.right) : '';
  const op = formula.connective;
  return `(${left} ${op} ${right})`;
}

/** Convert term to string (simplified). */
function termToString(term: Term): string {
  if (term.op === TermOp.VARIABLE) return term.name;
  if (term.op === TermOp.CONSTANT) return (term as ConstantTerm).value;
  const compound = term as CompoundTerm;
  const args = compound.args.map(termToString).join(', ');
  return `${compound.op}(${args})`;
}

/** Clause utilities. */
export function clause(...literals: Literal[]): Clause {
  return { literals };
}

export function literal(atom: Atom, sign: boolean): Literal {
  return { atom, sign };
}

export function cnf(clauses: readonly Clause[]): CNFFormula {
  return { clauses };
}