/**
 * Term validation - detect tautologies, contradictions, and invalid task terms
 */

import { getPredicate, getSubject, termsEqual, walkTerms } from './accessors.js';
import type { Term } from '../types.js';
import { isBoolAtom } from './intern.js';

const INVALID_TASK_SYMBOLS = new Set(['TRUE', 'FALSE', 'NULL']);

export const isTautology = (term: Term): boolean => {
  if (term.kind === 'inheritance' || term.kind === 'similarity') {
    const s = getSubject(term);
    const p = getPredicate(term);
    return !!(s && p && termsEqual(s, p));
  }
  return false;
};

export const isInvalidTaskTerm = (term: Term): boolean => {
  let found = false;
  walkTerms(term, (t) => {
    if (!found && t.kind === 'atom' && INVALID_TASK_SYMBOLS.has(t.symbol)) {
      found = true;
      return false; // prune
    }
  });
  return found;
};

export const validateTaskTerm = (
  term: Term
): { valid: true } | { valid: false; reason: string } => {
  if (isTautology(term))
    return { valid: false, reason: `Tautology: ${term.toString()} reduces to TRUE` };
  if (isInvalidTaskTerm(term))
    return {
      valid: false,
      reason: `Invalid task term: ${term.toString()} contains a reserved truth constant`,
    };
  return { valid: true };
};
