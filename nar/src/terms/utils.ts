import {jaccard} from '../utils';
import {termsEqual} from './accessors.js';
import type {Term} from './types.js';

export const extractSymbols = (term: Term, symbols = new Set<string>()): Set<string> => {
    if ('symbol' in term && typeof term.symbol === 'string') symbols.add(term.symbol);
    if ('args' in term && Array.isArray(term.args)) {
        for (const arg of term.args) {
            if (arg && typeof arg === 'object') extractSymbols(arg as Term, symbols);
        }
    }
    return symbols;
};

export const calculateSimilarity = (conceptTerm: Term, targetTerm: Term): number => {
    if (termsEqual(conceptTerm, targetTerm)) return 1;
    return jaccard(extractSymbols(conceptTerm), extractSymbols(targetTerm));
};
