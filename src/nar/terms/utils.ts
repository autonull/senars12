import type {Term} from './types.js';
import type {Concept} from '../memory/concept.js';
import {termsEqual} from './accessors.js';

export const extractSymbols = (term: Term, symbols = new Set<string>()): Set<string> => {
  if ('symbol' in term && typeof term.symbol === 'string') symbols.add(term.symbol);
  if ('args' in term && Array.isArray(term.args)) {
    for (const arg of term.args) {
      if (arg && typeof arg === 'object') extractSymbols(arg as Term, symbols);
    }
  }
  return symbols;
};

export const getTermHash = (term: unknown): number | undefined => {
  if (term && typeof term === 'object' && 'hash' in term) {
    return (term as {hash: number}).hash;
  }
  return undefined;
};

export const jaccardSimilarity = (setA: Set<string>, setB: Set<string>): number => {
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = new Set([...setA].filter(s => setB.has(s)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
};

export const calculateSimilarity = (concept: Concept, term: Term): number => {
  if (termsEqual(concept.term, term)) return 1;
  return jaccardSimilarity(extractSymbols(concept.term), extractSymbols(term));
};