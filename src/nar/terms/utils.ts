import type {Term} from './types.js';
import {termsEqual} from './accessors.js';
import {jaccard} from '../utils/similarity.js';

export const extractSymbols = (term: Term, symbols = new Set<string>()): Set<string> => {
    if ('symbol' in term && typeof term.symbol === 'string') symbols.add(term.symbol);
    if ('args' in term && Array.isArray(term.args)) {
        for (const arg of term.args) {
            if (arg && typeof arg === 'object') extractSymbols(arg as Term, symbols);
        }
    }
    return symbols;
};

export const jaccardSimilarity = (setA: Set<string>, setB: Set<string>): number =>
    jaccard(setA, setB);

export const calculateSimilarity = (conceptTerm: Term, targetTerm: Term): number => {
    if (termsEqual(conceptTerm, targetTerm)) return 1;
    return jaccardSimilarity(extractSymbols(conceptTerm), extractSymbols(targetTerm));
};
