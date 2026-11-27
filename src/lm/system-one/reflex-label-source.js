import { computeEvidenceId } from './distill';
/**
 * RL outcome label source (C4/R4): pipes (state, action, reward) outcomes into
 * the JudgmentDataset so `reflex_value` heads can be trained from play.
 * Redaction-per-retention — only the state-digest hash is stored, never raw text.
 */
export function recordReflexOutcome(dataset, input) {
    dataset.record({
        evidenceId: computeEvidenceId(input.stateDigest, `reflex:${input.action}`),
        rubric: 'reflex_value',
        axis: 'teleological',
        label: input.action,
        score: input.reward,
        source: input.source,
    }, input.embedding);
}
