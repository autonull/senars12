import { termsEqual } from './accessors.js';
import { TermBuilder } from './factory.js';
import { OPERATORS } from './operators.js';
import type { CompoundTerm, Term } from './types.js';

const COMPOUND_KINDS = new Set(Object.keys(OPERATORS));

const hasArgs = (term: Term): term is CompoundTerm =>
  term.kind !== 'atom' && COMPOUND_KINDS.has(term.kind);

const termSortKey = (t: Term): string => (t.kind === 'atom' ? t.symbol : String(t.kind));

export function normalize(term: Term): Term {
  if (term.kind === 'conjunction' || term.kind === 'disjunction') {
    const args = term.args ?? [];
    if (args.length <= 1) return term;
    const sortedArgs = args.toSorted((a, b) => termSortKey(a).localeCompare(termSortKey(b)));
    const allSorted = sortedArgs.every((arg, i) => termsEqual(arg, args[i]!));
    return allSorted ? term : TermBuilder.compound(term.kind, sortedArgs);
  }
  return term;
}

export type TermVisitorFn<T> = (term: Term) => T;

export function visit<T>(
  term: Term,
  visitor: TermVisitorFn<T>,
  order: 'pre-order' | 'post-order' = 'pre-order'
): void {
  if (order === 'pre-order') visitor(term);
  if (hasArgs(term)) {
    for (const arg of term.args ?? []) visit(arg, visitor, order);
  }
  if (order === 'post-order') visitor(term);
}

export type TermReducerFn<T> = (acc: T, term: Term) => T;

export function reduce<T>(term: Term, fn: TermReducerFn<T>, initial: T): T {
  let acc = fn(initial, term);
  if (hasArgs(term)) {
    for (const arg of term.args ?? []) acc = reduce(arg, fn, acc);
  }
  return acc;
}

export const getTermDepth = (term: Term): number => {
  if (term.kind === 'atom' || !hasArgs(term)) return 0;
  return 1 + Math.max(0, ...(term.args ?? []).map(getTermDepth));
};

export const getTermSize = (term: Term): number => {
  if (term.kind === 'atom') return 1;
  return 1 + (term.args ?? []).reduce((sum, arg) => sum + getTermSize(arg), 0);
};
