import { ctxNumber } from './conditions';
/**
 * No truth reading at all is *not* low confidence: absent is not 0, so this one
 * reads the context itself rather than going through {@link ctxNumber}.
 */
export const hasLowConfidence = (_primary, _secondary, ctx) => {
    const truth = ctx?.truth;
    return truth ? (truth.c ?? 0) < 0.5 : false;
};
export const hasConflictingBeliefs = (_primary, _secondary, ctx) => ctxNumber(ctx, 'conflictCount') > 0;
export const hasHighCuriosity = (_primary, _secondary, ctx) => ctxNumber(ctx, 'driveState.curiosity') > 0.6;
