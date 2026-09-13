/**
 * Connectivity/structural activation conditions for LM rules.
 */
import type { Term } from '../../terms';
import { calculateSimilarity, sharesSymbol } from '../../terms';

export const isUnderconnected = (
  _primary: Term,
  _secondary?: Term,
  ctx?: Record<string, unknown>
): boolean => {
  const linkCount = (ctx?.linkCount as number) ?? 0;
  const avgLinks = (ctx?.avgLinksPerConcept as number) ?? 5;
  return linkCount < avgLinks * 0.3;
};

export const hasStructuralSimilarityNoOverlap = (primary: Term, secondary?: Term): boolean => {
  if (!secondary) return false;
  const sim = calculateSimilarity(primary, secondary);
  return sim > 0.6 && !sharesSymbol(primary, secondary);
};
