import { safeRatio, sumBy } from '@senars/util';
import { SATURATION_COUNT } from '../constants.js';
import { clamp01 } from '@senars/util';
import type { CognitionContext, Reward } from './types.js';

/**
 * C4: seed rewards, firewall-classified. `extrinsic` rewards flow to
 * policy-weights only; `intrinsic` may shape attention. Weights per reward
 * are game parameters (weighted composition per game, R1).
 */

export const GROUNDEDNESS_REWARD: Reward = {
  id: 'groundedness',
  classification: 'extrinsic',
  score({ outcome }) {
    return clamp01(outcome?.groundedness ?? 0);
  },
};

export const TASK_SETTLED_REWARD: Reward = {
  id: 'task-settled',
  classification: 'extrinsic',
  score({ outcome }) {
    const attempted = outcome?.attempted ?? 0;
    return clamp01(safeRatio(outcome?.settled ?? 0, attempted));
  },
};

export const AMBIGUITY_REDUCTION_REWARD: Reward = {
  id: 'ambiguity-reduction',
  classification: 'intrinsic',
  score({ outcome }) {
    const before = outcome?.ambiguityBefore;
    const after = outcome?.ambiguityAfter;
    return before !== undefined && after !== undefined ? clamp01(before - after) : 0;
  },
};

export const SPEND_EFFICIENCY_REWARD: Reward = {
  id: 'spend-efficiency',
  classification: 'extrinsic',
  score({ outcome }) {
    const tokens = outcome?.tokens ?? 0;
    const settled = outcome?.settled ?? 0;
    return clamp01(safeRatio(settled, tokens));
  },
};

export const VETO_PENALTY: Reward = {
  id: 'veto-penalty',
  classification: 'extrinsic',
  score({ outcome }) {
    return -clamp01(outcome?.vetoes ?? 0);
  },
};

export const CONSOLIDATION_REWARD: Reward = {
  id: 'consolidation',
  classification: 'intrinsic',
  score({ outcome }) {
    return clamp01((outcome?.consolidations ?? 0) / SATURATION_COUNT);
  },
};

export const DEFAULT_REWARDS: readonly Reward[] = [
  GROUNDEDNESS_REWARD,
  TASK_SETTLED_REWARD,
  AMBIGUITY_REDUCTION_REWARD,
  SPEND_EFFICIENCY_REWARD,
  VETO_PENALTY,
  CONSOLIDATION_REWARD,
];

/** Weighted reward composition; weights are game parameters. */
export const composeReward = (
  rewards: readonly Reward[],
  weights: Record<string, number>,
  context: CognitionContext
): number => sumBy(rewards, (r) => (weights[r.id] ?? 0) * r.score(context));
