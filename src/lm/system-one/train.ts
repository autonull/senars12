/**
 * System One training — re-exports from focused modules.
 *
 * This file maintains backward compatibility for imports from `@senars/lm/system-one/train`.
 * New code should import directly from the focused modules:
 * - @senars/lm/system-one/features
 * - @senars/lm/system-one/data-loading
 * - @senars/lm/system-one/linear-algebra
 * - @senars/lm/system-one/head-training
 * - @senars/lm/system-one/bakeoff
 * - @senars/lm/system-one/head-artifacts
 * - @senars/lm/system-one/trained-head
 * - @senars/lm/system-one/types
 */

export {
  actionFeatures,
  ACTION_FEATURE_SEED,
  GAME_FEATURE_SEED,
  parseActionFromInstruction,
} from './features';

export { loadTrainingData } from './data-loading';
export type { LoadTrainingDataOptions } from './types';

export { solveLinearSystem } from './linear-algebra';

export { trainHead } from './head-training';
export type { TrainingOptions, TrainingRow } from './types';

export { bakeOffSharedHead } from './bakeoff';
export type { SharedHeadBakeOffOptions, SharedHeadBakeOffResult } from './types';

export {
  exportArtifacts,
  writeHeadArtifacts,
  loadHeadArtifacts,
  HeadArtifactConfigSchema,
} from './head-artifacts';
export type { HeadArtifactBundle, HeadArtifactConfig } from './types';

export { TrainedLinearHead } from './trained-head';
export type { JudgmentHead } from './types';

export * from './types';