/**
 * Confidence/conflict-based activation conditions for LM rules.
 */
import type { Term } from '../../terms';

export const hasLowConfidence = (
  _primary: Term,
  _secondary?: Term,
  ctx?: Record<string, unknown>
): boolean => {
  const truth = ctx?.truth as { f?: number; c?: number } | undefined;
  return truth ? (truth.c ?? 0) < 0.5 : false;
};

export const hasConflictingBeliefs = (
  _primary: Term,
  _secondary?: Term,
  ctx?: Record<string, unknown>
): boolean => {
  return ((ctx?.conflictCount as number) ?? 0) > 0;
};

export const hasHighCuriosity = (
  _primary: Term,
  _secondary?: Term,
  ctx?: Record<string, unknown>
): boolean => {
  const driveState = ctx?.driveState as Record<string, number> | undefined;
  return (driveState?.curiosity ?? 0) > 0.6;
};
