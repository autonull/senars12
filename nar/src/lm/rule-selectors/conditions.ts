/**
 * Activation predicates over terms, in a leaf module so the rule templates and
 * the rule factory can both reach them without an import cycle.
 */
import type { Term } from '../../terms';
import { isConjunction, isDisjunction, isInheritance, visitTerms } from '../../terms';

/** A goal that needs decomposing: compound, or two inheritance claims at once. */
export const isComplexGoal = (primary: Term): boolean => {
  if (isConjunction(primary) || isDisjunction(primary)) return true;
  let inheritanceCount = 0;
  visitTerms(primary, (t) => {
    if (isInheritance(t)) inheritanceCount++;
  });
  return inheritanceCount > 1;
};
