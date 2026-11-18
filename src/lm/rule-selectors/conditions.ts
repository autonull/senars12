/**
 * Activation predicates over terms, in a leaf module so the rule templates and
 * the rule factory can both reach them without an import cycle.
 */
import type { Term } from '../../terms';
import { isConjunction, isDisjunction, isInheritance, visitTerms } from '../../terms';

/**
 * A number out of a rule's activation context, by dotted `path`.
 *
 * The context is `Record<string, unknown>` because it is assembled per call from
 * whichever stores the rule was handed, so each probe re-derived the same read —
 * `(ctx?.conflictCount as number) ?? 0` — and `as number` on an absent field is a
 * claim the compiler cannot check and the runtime will not notice: `undefined > 0`
 * is quietly `false`, so a missing measurement and a measured zero were the same
 * answer by accident. Here a missing or non-numeric path *is* the fallback, which
 * is what every one of those sites meant.
 *
 * A caller that must distinguish "unmeasured" from "zero" does not use this — it
 * reads `ctx` itself, because that distinction is a claim about the world rather
 * than a measurement of it.
 */
export const ctxNumber = (
  ctx: Record<string, unknown> | undefined,
  path: string,
  fallback = 0
): number => {
  const [head, ...rest] = path.split('.');
  const value = rest.reduce<unknown>(
    (node, key) => (node as Record<string, unknown> | undefined)?.[key],
    ctx?.[head ?? '']
  );
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

/** A goal that needs decomposing: compound, or two inheritance claims at once. */
export const isComplexGoal = (primary: Term): boolean => {
  if (isConjunction(primary) || isDisjunction(primary)) return true;
  let inheritanceCount = 0;
  visitTerms(primary, (t) => {
    if (isInheritance(t)) inheritanceCount++;
  });
  return inheritanceCount > 1;
};
