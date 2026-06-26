/**
 * Term validation - detect tautologies, contradictions, and invalid task terms
 */

import type {Term} from './types.js';
import {getPredicate, getSubject, termsEqual} from './accessors.js';

const INVALID_TASK_SYMBOLS = new Set(['TRUE', 'FALSE']);

export const isTautology = (term: Term): boolean => {
    if (term.kind === 'inheritance' || term.kind === 'similarity') {
        const s = getSubject(term);
        const p = getPredicate(term);
        return !!(s && p && termsEqual(s, p));
    }
    return false;
};

export const isInvalidTaskTerm = (term: Term): boolean => {
    if (term.kind === 'atom') return INVALID_TASK_SYMBOLS.has(term.symbol);
    return false;
};

export const validateTaskTerm = (term: Term): { valid: true } | { valid: false; reason: string } => {
    if (isTautology(term)) return {valid: false, reason: `Tautology: ${term.toString()} reduces to TRUE`};
    if (isInvalidTaskTerm(term)) return {
        valid: false,
        reason: `Invalid task term: ${term.symbol} is a reserved truth constant`
    };
    return {valid: true};
};
