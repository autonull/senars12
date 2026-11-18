/**
 * Confidence/conflict-based activation conditions for LM rules.
 */
import type { Term } from '../../terms';
import { ctxNumber } from './conditions.js';

/**
 * No truth reading at all is *not* low confidence: absent is not 0, so this one
 * reads the context itself rather than going through {@link ctxNumber}.
 */
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
): boolean => ctxNumber(ctx, 'conflictCount') > 0;

export const hasHighCuriosity = (
  _primary: Term,
  _secondary?: Term,
  ctx?: Record<string, unknown>
): boolean => ctxNumber(ctx, 'driveState.curiosity') > 0.6;
