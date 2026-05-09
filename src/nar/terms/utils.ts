import type {Term} from './types.js';
import type {Concept} from '../memory/concept.js';

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

export const calculateSimilarity = (concept: Concept, term: Term): number => {
  if (concept.term.hash === term.hash) return 1;

  const thisSymbols = extractSymbols(concept.term);
  const otherSymbols = extractSymbols(term);

  const intersection = new Set([...thisSymbols].filter(s => otherSymbols.has(s)));
  const union = new Set([...thisSymbols, ...otherSymbols]);

  return union.size > 0 ? intersection.size / union.size : 0;
};