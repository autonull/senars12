/**
 * CNF Conversion — Tseitin transformation for first-order formulas.
 *
 * Converts arbitrary formulas to Conjunctive Normal Form using
 * Tseitin encoding to avoid exponential blowup.
 */

import { Term, VariableTerm, TermOp, termInterner, CompoundTerm, ConstantTerm } from '../../kernel/terms/intern';
import {
  Formula,
  Atom,
  Clause,
  Literal,
  CNFFormula,
  Connective,
  isAtom,
  isQuantified,
  isCompound,
  freeVariables,
  and,
  or,
  not,
  implies,
  forall,
  exists,
  atom,
  clause,
  literal,
  cnf,
} from './ast';

/** Tseitin variable generator. */
class TseitinGenerator {
  private counter = 0;
  private prefix = 't';

  /** Generate a fresh Tseitin variable. */
  fresh(prefix?: string): VariableTerm {
    return termInterner.variable(`${prefix ?? this.prefix}${this.counter++}`);
  }

  /** Reset counter. */
  reset(): void {
    this.counter = 0;
  }
}

/** CNF conversion state. */
interface CNFState {
  generator: TseitinGenerator;
  clauses: Clause[];
  definitions: Map<VariableTerm, Formula>; // Tseitin var -> formula
}

/** Convert formula to CNF using Tseitin transformation. */
export function toCNF(formula: Formula): CNFFormula {
  const generator = new TseitinGenerator();
  const state: CNFState = {
    generator,
    clauses: [],
    definitions: new Map(),
  };

  // Convert to NNF first
  const nnf = toNNF(formula);

  // Introduce Tseitin variable for top-level formula
  const topVar = generator.fresh('top');
  state.definitions.set(topVar, nnf);

  // Generate clauses
  cnfRec(topVar, nnf, state);

  // Add unit clause for top variable
  state.clauses.push(clause(literal(atom(topVar.name, [], false), true)));

  return cnf(state.clauses);
}

/** Convert formula to Negation Normal Form (NNF). */
export function toNNF(formula: Formula): Formula {
  function nnf(f: Formula, negated = false): Formula {
    if (isAtom(f)) {
      return negated ? { ...f, negated: !f.negated } : f;
    }

    if (isQuantified(f)) {
      if (negated) {
        // ~∀x.P = ∃x.~P, ~∃x.P = ∀x.~P
        const newQuant = f.quantifier === Connective.FORALL ? Connective.EXISTS : Connective.FORALL;
        return { quantifier: newQuant, variables: f.variables, body: nnf(f.body, true) };
      }
      return { ...f, body: nnf(f.body, false) };
    }

    // Compound formula
    switch (f.connective) {
      case Connective.NOT:
        return nnf(f.operand!, !negated);
      case Connective.AND:
        if (negated) {
          // ~(A & B) = ~A | ~B
          return or(nnf(f.left!, true), nnf(f.right!, true));
        }
        return and(nnf(f.left!, false), nnf(f.right!, false));
      case Connective.OR:
        if (negated) {
          // ~(A | B) = ~A & ~B
          return and(nnf(f.left!, true), nnf(f.right!, true));
        }
        return or(nnf(f.left!, false), nnf(f.right!, false));
      case Connective.IMPLIES:
        if (negated) {
          // ~(A ==> B) = A & ~B
          return and(nnf(f.left!, false), nnf(f.right!, true));
        }
        // A ==> B = ~A | B
        return or(nnf(f.left!, true), nnf(f.right!, false));
      case Connective.IFF:
        if (negated) {
          // ~(A <=> B) = (A & ~B) | (~A & B)
          return or(
            and(nnf(f.left!, false), nnf(f.right!, true)),
            and(nnf(f.left!, true), nnf(f.right!, false))
          );
        }
        // A <=> B = (~A | B) & (A | ~B)
        return and(
          or(nnf(f.left!, true), nnf(f.right!, false)),
          or(nnf(f.left!, false), nnf(f.right!, true))
        );
      default:
        return f;
    }
  }

  return nnf(formula, false);
}

/** Recursive CNF generation with Tseitin variables. */
function cnfRec(tseitinVar: VariableTerm, formula: Formula, state: CNFState): void {
  if (isAtom(formula)) {
    // Atomic formula: tseitinVar <=> atom
    // (tseitinVar | ~atom) & (~tseitinVar | atom)
    const atomLit = literal(formula, !formula.negated);
    const tseitinLit = literal(atom(tseitinVar.name, [], false), true);
    const negTseitinLit = literal(atom(tseitinVar.name, [], false), false);

    state.clauses.push(clause(tseitinLit, atomLit));
    state.clauses.push(clause(negTseitinLit, literal(formula, formula.negated)));
    return;
  }

  if (isQuantified(formula)) {
    // For quantified formulas, we need to handle specially
    // In practice, we Skolemize first, then convert
    // For now, treat as atomic (placeholder)
    const atomLit = literal(atom(`Q_${tseitinVar.name}`, [], false), true);
    const tseitinLit = literal(atom(tseitinVar.name, [], false), true);
    state.clauses.push(clause(tseitinLit, atomLit));
    return;
  }

  // Compound formula
  switch (formula.connective) {
    case Connective.NOT: {
      // t <=> ~a  =>  (t | a) & (~t | ~a)
      const operand = formula.operand!;
      const operandVar = state.generator.fresh('not');
      state.definitions.set(operandVar, operand);
      cnfRec(operandVar, operand, state);

      const tLit = literal(atom(tseitinVar.name, [], false), true);
      const oLit = literal(atom(operandVar.name, [], false), true);
      const negTLit = literal(atom(tseitinVar.name, [], false), false);
      const negOLit = literal(atom(operandVar.name, [], false), false);

      state.clauses.push(clause(tLit, negOLit));
      state.clauses.push(clause(negTLit, oLit));
      break;
    }

    case Connective.AND: {
      // t <=> (a & b)  =>  (t | ~a | ~b) & (~t | a) & (~t | b)
      const left = formula.left!;
      const right = formula.right!;
      const leftVar = state.generator.fresh('and_l');
      const rightVar = state.generator.fresh('and_r');
      state.definitions.set(leftVar, left);
      state.definitions.set(rightVar, right);
      cnfRec(leftVar, left, state);
      cnfRec(rightVar, right, state);

      const tLit = literal(atom(tseitinVar.name, [], false), true);
      const negTLit = literal(atom(tseitinVar.name, [], false), false);
      const lLit = literal(atom(leftVar.name, [], false), true);
      const rLit = literal(atom(rightVar.name, [], false), true);
      const negLLit = literal(atom(leftVar.name, [], false), false);
      const negRLit = literal(atom(rightVar.name, [], false), false);

      // (t | ~l | ~r)
      state.clauses.push(clause(tLit, negLLit, negRLit));
      // (~t | l)
      state.clauses.push(clause(negTLit, lLit));
      // (~t | r)
      state.clauses.push(clause(negTLit, rLit));
      break;
    }

    case Connective.OR: {
      // t <=> (a | b)  =>  (~t | a | b) & (t | ~a) & (t | ~b)
      const left = formula.left!;
      const right = formula.right!;
      const leftVar = state.generator.fresh('or_l');
      const rightVar = state.generator.fresh('or_r');
      state.definitions.set(leftVar, left);
      state.definitions.set(rightVar, right);
      cnfRec(leftVar, left, state);
      cnfRec(rightVar, right, state);

      const tLit = literal(atom(tseitinVar.name, [], false), true);
      const negTLit = literal(atom(tseitinVar.name, [], false), false);
      const lLit = literal(atom(leftVar.name, [], false), true);
      const rLit = literal(atom(rightVar.name, [], false), true);
      const negLLit = literal(atom(leftVar.name, [], false), false);
      const negRLit = literal(atom(rightVar.name, [], false), false);

      // (~t | l | r)
      state.clauses.push(clause(negTLit, lLit, rLit));
      // (t | ~l)
      state.clauses.push(clause(tLit, negLLit));
      // (t | ~r)
      state.clauses.push(clause(tLit, negRLit));
      break;
    }

    case Connective.IMPLIES: {
      // t <=> (a ==> b)  =>  t <=> (~a | b)
      const left = formula.left!;
      const right = formula.right!;
      const leftVar = state.generator.fresh('imp_l');
      const rightVar = state.generator.fresh('imp_r');
      state.definitions.set(leftVar, left);
      state.definitions.set(rightVar, right);
      cnfRec(leftVar, left, state);
      cnfRec(rightVar, right, state);

      const tLit = literal(atom(tseitinVar.name, [], false), true);
      const negTLit = literal(atom(tseitinVar.name, [], false), false);
      const lLit = literal(atom(leftVar.name, [], false), true);
      const rLit = literal(atom(rightVar.name, [], false), true);
      const negLLit = literal(atom(leftVar.name, [], false), false);

      // (~t | ~l | r)
      state.clauses.push(clause(negTLit, negLLit, rLit));
      // (t | l)
      state.clauses.push(clause(tLit, lLit));
      // (t | ~r)
      state.clauses.push(clause(tLit, literal(atom(rightVar.name, [], false), false)));
      break;
    }

    case Connective.IFF: {
      // t <=> (a <=> b)  =>  t <=> (a & b) | (~a & ~b)
      const left = formula.left!;
      const right = formula.right!;
      const leftVar = state.generator.fresh('iff_l');
      const rightVar = state.generator.fresh('iff_r');
      state.definitions.set(leftVar, left);
      state.definitions.set(rightVar, right);
      cnfRec(leftVar, left, state);
      cnfRec(rightVar, right, state);

      const tLit = literal(atom(tseitinVar.name, [], false), true);
      const negTLit = literal(atom(tseitinVar.name, [], false), false);
      const lLit = literal(atom(leftVar.name, [], false), true);
      const rLit = literal(atom(rightVar.name, [], false), true);
      const negLLit = literal(atom(leftVar.name, [], false), false);
      const negRLit = literal(atom(rightVar.name, [], false), false);

      // (t | l | ~r) & (t | ~l | r) & (~t | l | r) & (~t | ~l | ~r)
      state.clauses.push(clause(tLit, lLit, negRLit));
      state.clauses.push(clause(tLit, negLLit, rLit));
      state.clauses.push(clause(negTLit, lLit, rLit));
      state.clauses.push(clause(negTLit, negLLit, negRLit));
      break;
    }
  }
}

/** Skolemize a formula (remove existential quantifiers). */
export function skolemize(formula: Formula): Formula {
  const skolemCounter = { n: 0 };
  const universalVars: VariableTerm[] = [];

  function skol(f: Formula): Formula {
    if (isAtom(f)) return f;

    if (isQuantified(f)) {
      if (f.quantifier === Connective.FORALL) {
        const newUniversals = [...universalVars, ...f.variables];
        const oldUniversals = universalVars;
        universalVars.push(...f.variables);
        const body = skol(f.body);
        universalVars.length = oldUniversals.length;
        return { quantifier: Connective.FORALL, variables: f.variables, body };
      } else {
        // Existential: replace with Skolem function
        const skolemName = `sk${skolemCounter.n++}`;
        const skolemArgs = [...universalVars];
        const skolemTerm = skolemArgs.length === 0
          ? termInterner.constant(skolemName)
          : termInterner.compound(TermOp.PRODUCT, ...skolemArgs);

        // Substitute the existential variable with Skolem term
        return substitute(f.body, f.variables[0]!, skolemTerm);
      }
    }

    if (isCompound(f)) {
      return {
        ...f,
        left: f.left ? skol(f.left) : undefined,
        right: f.right ? skol(f.right) : undefined,
        operand: f.operand ? skol(f.operand) : undefined,
      };
    }

    return f;
  }

  return skol(formula);
}

/** Substitute variable in formula. */
function substitute(formula: Formula, variable: VariableTerm, replacement: Term): Formula {
  if (isAtom(formula)) {
    return {
      ...formula,
      args: formula.args.map(arg => substituteTerm(arg, variable, replacement)),
    };
  }

  if (isQuantified(formula)) {
    // Don't substitute bound variables
    if (formula.variables.some(v => v === variable)) return formula;
    return { ...formula, body: substitute(formula.body, variable, replacement) };
  }

  if (isCompound(formula)) {
    return {
      ...formula,
      left: formula.left ? substitute(formula.left, variable, replacement) : undefined,
      right: formula.right ? substitute(formula.right, variable, replacement) : undefined,
      operand: formula.operand ? substitute(formula.operand, variable, replacement) : undefined,
    };
  }

  return formula;
}

function substituteTerm(term: Term, variable: VariableTerm, replacement: Term): Term {
  if (term === variable) return replacement;
  if (term.op === TermOp.VARIABLE || term.op === TermOp.CONSTANT) return term;

  const ct = term as import('../../kernel/terms/intern').CompoundTerm;
  const newArgs = ct.args.map(arg => substituteTerm(arg, variable, replacement));
  if (newArgs.every((arg, i) => arg === ct.args[i])) return term;
  return termInterner.compound(ct.op, ...newArgs);
}