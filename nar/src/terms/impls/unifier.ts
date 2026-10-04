import {
  Unifier,
  type UnifierDialect,
  type UnifierSubstitution,
} from '@senars/util';
import type { Term } from '../types.js';
import { isVariableSymbol } from '../types.js';
import { getArgs, sameKind, termKey, termsEqual } from './accessors.js';
import { TermBuilder } from './factory.js';

/** The unifier's own substitution type — util's, bound to the term dialect. */
export type Substitution = UnifierSubstitution<Term>;

/** How the generic unifier reads a Narsese term. */
const DIALECT: UnifierDialect<Term> = {
  variableName: (t) => (t.kind === 'atom' && isVariableSymbol(t.symbol) ? t.symbol : null),
  key: termKey,
  equal: termsEqual,
  sameHead: sameKind,
  children: getArgs,
  rebuild: (node, kids) => TermBuilder.compound(node.kind as never, [...kids]),
};

const unifier = new Unifier(DIALECT);

/**
 * Unify two terms, extending `subst`. Returns the extended substitution, or
 * `undefined` when they do not unify — in which case `subst` is unchanged.
 */
export function unify(
  a: Term,
  b: Term,
  subst: Substitution = new Map(),
  enableOccursCheck = true
): Map<string, Term> | undefined {
  const result = unifier.unify(a, b, subst, {
    occursCheck: enableOccursCheck,
  });
  return result ?? undefined;
}

/** Substitute through `term` until no bound variable remains. Idempotent. */
export const applySubstitution = (term: Term, subst: Substitution): Term =>
  unifier.apply(term, subst);
