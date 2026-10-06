/**
 * Connectivity/structural activation conditions for LM rules.
 */
import type { Term } from '../../terms';
import { calculateSimilarity, sharesSymbol } from '../../terms';
import { ctxNumber } from './conditions.js';

export const isUnderconnected = (
  _primary: Term,
  _secondary?: Term,
  ctx?: Record<string, unknown>
): boolean => {
  return ctxNumber(ctx, 'linkCount') < ctxNumber(ctx, 'avgLinksPerConcept', 5) * 0.3;
};

export const hasStructuralSimilarityNoOverlap = (primary: Term, secondary?: Term): boolean => {
  if (!secondary) return false;
  const sim = calculateSimilarity(primary, secondary);
  return sim > 0.6 && !sharesSymbol(primary, secondary);
};
