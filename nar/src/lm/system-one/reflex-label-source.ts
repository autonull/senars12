import { computeEvidenceId, type JudgmentDataset } from './distill.js';

export interface ReflexOutcomeInput {
  stateDigest: string;
  action: string;
  reward: number;
  source: string;
  /** Optional 384-d state embedding for the Z1 vector sidecar (redaction-safe). */
  embedding?: Float32Array;
}

/**
 * RL outcome label source (C4/R4): pipes (state, action, reward) outcomes into
 * the JudgmentDataset so `reflex_value` heads can be trained from play.
 * Redaction-per-retention — only the state-digest hash is stored, never raw text.
 */
export function recordReflexOutcome(dataset: JudgmentDataset, input: ReflexOutcomeInput): void {
  const stateVectorKey = computeEvidenceId(input.stateDigest, 'state');
  dataset.record({
    evidenceId: computeEvidenceId(input.stateDigest, `reflex:${input.action}`),
    rubric: 'reflex_value',
    axis: 'teleological',
    label: input.action,
    score: input.reward,
    vecRef: stateVectorKey,
    source: input.source,
  });
  if (input.embedding) dataset.recordVector(stateVectorKey, input.embedding);
}
