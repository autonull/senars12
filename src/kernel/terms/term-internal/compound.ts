/**
 * Compound Term Operations — utilities for compound terms.
 */

import type { Term, CompoundTerm } from './types';
import { TermOp } from '../term-ops';

/** Get term arguments. */
export function getArgs(term: Term): readonly Term[] {
  if (term.op !== TermOp.VARIABLE && term.op !== TermOp.CONSTANT) {
    return term.args;
  }
  return [];
}

/** Check if term is an inheritance statement. */
export function isInheritance(term: Term): boolean {
  return isCompound(term) && term.op === TermOp.INHERITANCE;
}

/** Check if term is a conjunction. */
export function isConjunction(term: Term): boolean {
  return isCompound(term) && term.op === TermOp.CONJUNCTION;
}

/** Check if term is a disjunction. */
export function isDisjunction(term: Term): boolean {
  return isCompound(term) && term.op === TermOp.DISJUNCTION;
}

/** Check if term is a negation. */
export function isNegation(term: Term): boolean {
  return isCompound(term) && term.op === TermOp.NEGATION;
}

/** Check if term is a similarity. */
export function isSimilarity(term: Term): boolean {
  return isCompound(term) && term.op === TermOp.SIMILARITY;
}

/** Check if term is an implication. */
export function isImplication(term: Term): boolean {
  return isCompound(term) && (term.op === TermOp.IMPLICATION || term.op === TermOp.PREDICTIVE_IMPLICATION);
}

/** Check if term is an equivalence. */
export function isEquivalence(term: Term): boolean {
  return isCompound(term) && term.op === TermOp.EQUIVALENCE;
}

/** Check if term is a statement (inheritance, similarity, etc.). */
export function isStatement(term: Term): boolean {
  return isCompound(term) &&
    (term.op === TermOp.INHERITANCE ||
      term.op === TermOp.SIMILARITY ||
      term.op === TermOp.IMPLICATION ||
      term.op === TermOp.PREDICTIVE_IMPLICATION ||
      term.op === TermOp.EQUIVALENCE);
}

/** Check if term is a question (uses STATEMENT/QUESTION/GOAL punctuation). */
export function isQuestion(term: Term): boolean {
  return isCompound(term) && term.op === TermOp.QUESTION;
}

/** Check if term is a goal (uses STATEMENT/QUESTION/GOAL punctuation). */
export function isGoal(term: Term): boolean {
  return isCompound(term) && term.op === TermOp.GOAL;
}

/** Check if term is atomic (variable or constant). */
export function isAtomic(term: Term): boolean {
  return term.op === TermOp.VARIABLE || term.op === TermOp.CONSTANT;
}

/** Check if term is compound (not atomic). */
export function isCompound(term: Term): term is CompoundTerm {
  return term.op !== TermOp.VARIABLE && term.op !== TermOp.CONSTANT;
}

/** Check if term has any variables. */
export function hasVariable(term: Term): boolean {
  if (term.op === TermOp.VARIABLE) return true;
  if (isCompound(term)) {
    return term.args.some(hasVariable);
  }
  return false;
}

/** Get all symbols in a term. */
export function getSymbols(term: Term): Set<string> {
  const symbols = new Set<string>();

  function collect(t: Term): void {
    if (t.op === TermOp.CONSTANT) {
      symbols.add(t.value);
    } else if (isCompound(t)) {
      for (const arg of t.args) {
        collect(arg);
      }
    }
  }

  collect(term);
  return symbols;
}

/** Check if two terms share any symbol. */
export function sharesSymbol(a: Term, b: Term): boolean {
  const aSymbols = getSymbols(a);
  const bSymbols = getSymbols(b);
  for (const s of aSymbols) {
    if (bSymbols.has(s)) return true;
  }
  return false;
}

/** Calculate structural similarity between two terms (0-1). */
export function calculateSimilarity(a: Term, b: Term): number {
  if (a.hash === b.hash) return 1.0;

  const aSyms = getSymbols(a);
  const bSyms = getSymbols(b);

  if (aSyms.size === 0 && bSyms.size === 0) return 1.0;
  if (aSyms.size === 0 || bSyms.size === 0) return 0.0;

  let intersection = 0;
  for (const s of aSyms) {
    if (bSyms.has(s)) intersection++;
  }
  const union = aSyms.size + bSyms.size - intersection;
  return intersection / union;
}

/** Visit all subterms. */
export function visitTerms(term: Term, visitor: (t: Term) => void): void {
  visitor(term);
  if (isCompound(term)) {
    for (const arg of term.args) {
      visitTerms(arg, visitor);
    }
  }
}

/** Create a term key for hashing/lookup. */
export function termKey(term: Term): string {
  if (term.op === TermOp.VARIABLE) {
    return `var:${term.name}`;
  }
  if (term.op === TermOp.CONSTANT) {
    return `const:${term.value}`;
  }
  const argKeys = term.args.map(termKey).join(',');
  return `${term.op}(${argKeys})`;
}