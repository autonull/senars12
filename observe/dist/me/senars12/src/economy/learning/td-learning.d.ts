/**
 * TD Learning — online temporal difference learning for value estimation.
 */
import type { EconomyTask } from '../types';
import type { TDLearningConfig, ValueWeights, SuccessorFeatures } from './features';
import type { Clock } from '../../kernel/env';
/**
 * Learn from a single transition (online TD).
 */
export declare function tdStep(from: EconomyTask, to: EconomyTask[], reward: number, valueWeights: ValueWeights, config?: TDLearningConfig, clock?: Clock): ValueWeights;
/** Convert successor features to Successor format for scheduler. */
export declare function successorFeaturesToSuccessors(sf: SuccessorFeatures, valueWeights: ValueWeights): import('../types').Successor[];
/** Merge multiple successor feature estimates (e.g., from different log segments). */
export declare function mergeSuccessorFeatures(features: SuccessorFeatures[], weights?: number[]): SuccessorFeatures;
//# sourceMappingURL=td-learning.d.ts.map