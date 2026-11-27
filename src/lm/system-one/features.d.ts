/**
 * Feature construction for System One heads.
 * Deterministic per-action/game feature blocks via seeded hashing.
 */
import { releaseFeatureVector } from '@senars/util/random';
/** Action-block seed. Distinct from the game block's so the two never collide. */
export declare const ACTION_FEATURE_SEED = 2654435769;
/** Game-block seed distinct from the action seed so the two blocks never collide. */
export declare const GAME_FEATURE_SEED = 2246822507;
/**
 * Deterministic per-action feature block so one head can score (state, action) pairs.
 * Uses pooled buffers to avoid allocation per call.
 */
export declare function actionFeatures(action: string, dim: number, seed?: number): Float32Array;
/** Release a pooled feature vector back to the pool. */
export { releaseFeatureVector };
/** Parse the action name from a judgment instruction string. */
export declare function parseActionFromInstruction(instruction: string): string;
//# sourceMappingURL=features.d.ts.map