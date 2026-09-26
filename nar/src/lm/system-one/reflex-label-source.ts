import { computeEvidenceId, type JudgmentDataset } from './distill.js';

export interface ReflexOutcomeInput {
  stateDigest: string;
  action: string;
  reward: number;
  source: string;
  /** Optional 384-d state embedding for inline vector storage (redaction-safe). */
  embedding?: Float32Array;
}

/**
 * RL outcome label source (C4/R4): pipes (state, action, reward) outcomes into
 * the JudgmentDataset so `reflex_value` heads can be trained from play.
 * Redaction-per-retention — only the state-digest hash is stored, never raw text.
 */
export function recordReflexOutcome(dataset: JudgmentDataset, input: ReflexOutcomeInput): void {
  dataset.record(
    {
      evidenceId: computeEvidenceId(input.stateDigest, `reflex:${input.action}`),
      rubric: 'reflex_value',
      axis: 'teleological',
      label: input.action,
      score: input.reward,
      source: input.source,
    },
    input.embedding
  );
}
