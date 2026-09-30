import type { Term } from '../types.js';
import { applyBindings } from './unifier.js';

/**
 * Substitute `bindings` through `term`. Thin alias over the unifier's
 * substitution pass, so variable recognition can never drift from the rule
 * that binds them.
 */
export const substituteVariables = (term: Term, bindings: ReadonlyMap<string, Term>): Term =>
  applyBindings(term, bindings);
