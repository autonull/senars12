import type { Term } from '../types.js';
import { termsEqual } from './accessors.js';
import { compareForCanonicalOrder, TermBuilder } from './factory.js';

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
