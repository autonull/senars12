import { jaccard } from '../utils';
import { collectAtomicSymbols, termsEqual } from './accessors.js';
import type { Term } from './types.js';

export const extractSymbols = (term: Term, symbols = new Set<string>()): Set<string> =>
  collectAtomicSymbols(term, symbols);

/** A term whose symbol bag is already extracted, for scoring one query against
 *  many candidates without re-walking the query per comparison. */
export interface SymbolQuery {
  readonly term: Term;
  readonly symbols: Set<string>;
}

export const symbolQuery = (term: Term): SymbolQuery => ({
  term,
  symbols: collectAtomicSymbols(term),
});

export const similarityTo = (query: SymbolQuery, candidate: Term): number =>
  termsEqual(query.term, candidate) ? 1 : jaccard(query.symbols, collectAtomicSymbols(candidate));

export const calculateSimilarity = (conceptTerm: Term, targetTerm: Term): number =>
  similarityTo(symbolQuery(conceptTerm), targetTerm);
