import { computeEvidenceId, type JudgmentDataset } from './distill.js';

/**
 * L2 (V3): MC-return labels as a LabelSource — not a train.ts special case.
 * Folds discounted returns over an episode's (action, reward) ticks and pipes
 * the folded labels into the same JudgmentDataset as the other sources.
 * γ=0.95 default (DQ3), per-game override via spec params.
 */
export interface McReturnInput {
  episodeId: string;
  ticks: readonly { action: string; reward: number }[];
  gamma?: number;
}

export const mcReturns = (ticks: readonly { reward: number }[], gamma = 0.95): number[] => {
  const returns: number[] = [];
  let acc = 0;
  for (let i = ticks.length - 1; i >= 0; i--) {
    acc = ticks[i]!.reward + gamma * acc;
    returns[i] = acc;
  }
  return returns;
};

export function recordMcReturnLabels(dataset: JudgmentDataset, input: McReturnInput): number[] {
  const returns = mcReturns(input.ticks, input.gamma);
  input.ticks.forEach((tick, i) => {
    dataset.record({
      evidenceId: computeEvidenceId(input.episodeId, `mc-return:${i}:${tick.action}`),
      rubric: 'mc-return',
      axis: 'temporal',
      label: tick.action,
      score: returns[i],
      observed: tick.reward,
      source: 'McReturnLabelSource',
    });
  });
  return returns;
}
