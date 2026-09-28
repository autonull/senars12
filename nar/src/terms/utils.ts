import { jaccard } from '../utils';
import { collectAtomicSymbols, termsEqual } from './accessors.js';
import type { Term } from './types.js';

export const extractSymbols = (term: Term, symbols = new Set<string>()): Set<string> =>
  collectAtomicSymbols(term, symbols);

export const calculateSimilarity = (conceptTerm: Term, targetTerm: Term): number => {
  if (termsEqual(conceptTerm, targetTerm)) return 1;
  return jaccard(extractSymbols(conceptTerm), extractSymbols(targetTerm));
};
