/**
 * Feature construction for System One heads.
 * Deterministic per-action/game feature blocks via seeded hashing.
 */
import { fillSeededUnitRangePooled, releaseFeatureVector } from '@senars/util/random';
import { seededStringHash } from '@senars/util/hash';
/** Action-block seed. Distinct from the game block's so the two never collide. */
export const ACTION_FEATURE_SEED = 0x9e3779b9;
/** Game-block seed distinct from the action seed so the two blocks never collide. */
export const GAME_FEATURE_SEED = 0x85ebca6b;
/**
 * Deterministic per-action feature block so one head can score (state, action) pairs.
 * Uses pooled buffers to avoid allocation per call.
 */
export function actionFeatures(action, dim, seed = ACTION_FEATURE_SEED) {
    return fillSeededUnitRangePooled(dim, seededStringHash(action, seed ^ dim));
}
/** Release a pooled feature vector back to the pool. */
export { releaseFeatureVector };
/** Parse the action name from a judgment instruction string. */
export function parseActionFromInstruction(instruction) {
    return instruction.match(/action (\S+)$/)?.[1] ?? '';
}
