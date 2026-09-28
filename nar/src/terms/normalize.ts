import { termsEqual } from './accessors.js';
import { compareForCanonicalOrder, TermBuilder } from './factory.js';
import { OPERATORS } from './operators.js';
import type { CompoundTerm, Term } from './types.js';

const COMPOUND_KINDS = new Set(Object.keys(OPERATORS));

const hasArgs = (term: Term): term is CompoundTerm =>
  term.kind !== 'atom' && COMPOUND_KINDS.has(term.kind);

export function normalize(term: Term): Term {
  if (term.kind === 'conjunction' || term.kind === 'disjunction') {
    const args = term.args ?? [];
    if (args.length <= 1) return term;
    const sortedArgs = args.toSorted(compareForCanonicalOrder);
    const allSorted = sortedArgs.every((arg, i) => termsEqual(arg, args[i]!));
    return allSorted ? term : TermBuilder.compound(term.kind, sortedArgs);
  }
  return term;
}
