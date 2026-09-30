import { Unifier, type UnifierDialect } from '@senars/util';
import type { Term } from '../types.js';
import { isVariableSymbol } from '../types.js';
import { getArgs, sameKind, termKey, termsEqual } from './accessors.js';
import { TermBuilder } from './factory.js';

export type Substitution = Record<string, Term>;

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
  subst: Substitution = {},
  enableOccursCheck = true
): Substitution | undefined {
  const result = unifier.unify(a, b, new Map(Object.entries(subst)), {
    occursCheck: enableOccursCheck,
  });
  return result ? Object.fromEntries(result) : undefined;
}

/** Substitute through `term` until no bound variable remains. */
export const applyBindings = (term: Term, bindings: ReadonlyMap<string, Term>): Term =>
  unifier.apply(term, bindings);

/** {@link applyBindings} over the object-literal substitution this module exports. */
export const applySubstitution = (term: Term, subst: Substitution): Term =>
  applyBindings(term, new Map(Object.entries(subst)));

/** Every variable symbol in `term`, in first-occurrence order. */
export const termVariables = (term: Term): string[] => unifier.variables(term);
