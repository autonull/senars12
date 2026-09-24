import { computeEvidenceId, type JudgmentDataset } from './distill.js';
import { REACTION_SOURCE } from './eval-set.js';
import type { ReactionKind } from '../../dialogue/types.js';

export interface CorrectionLabelInput {
  originalNL: string;
  correctedNarsese: string;
}

export interface DerivationOutcomeLabelInput {
  ruleId: string;
  outcome: 'accepted' | 'rejected';
}

/**
 * Label-source adapters (§9.1): pipe event-sourced outcomes into the
 * append-only JudgmentDataset. Redaction-per-retention — only evidence
 * hashes and labels are stored, never raw utterance text.
 */

export function recordCorrectionLabel(dataset: JudgmentDataset, input: CorrectionLabelInput): void {
  dataset.record({
    evidenceId: computeEvidenceId(input.originalNL, 'correction'),
    rubric: 'task_type',
    axis: 'epistemic',
    label: 'correction',
    source: 'FeedbackLearner.onCorrection',
  });
}

export function recordDerivationOutcomeLabel(
  dataset: JudgmentDataset,
  input: DerivationOutcomeLabelInput
): void {
  dataset.record({
    evidenceId: computeEvidenceId(input.ruleId, `derivation-outcome:${input.outcome}`),
    rubric: 'plausibility',
    axis: 'epistemic',
    label: input.outcome,
    source: 'FeedbackLearner.onDerivationOutcome',
  });
}

export function recordApprovalLabel(
  dataset: JudgmentDataset,
  input: { action: string; approved: boolean; embedding?: Float32Array; predicted?: number }
): void {
  dataset.record(
    {
      evidenceId: computeEvidenceId(
        input.action,
        `approval:${input.approved ? 'approved' : 'rejected'}`
      ),
      rubric: 'risk',
      axis: 'teleological',
      label: input.approved ? 'approved' : 'rejected',
      score: input.predicted,
      observed: input.approved ? 1 : 0,
      source: 'ApprovalService',
    },
    input.embedding
  );
}

export function recordShadowVerdictLabel(
  dataset: JudgmentDataset,
  input: { derivationId: string; verdict: 'support' | 'conflict'; embedding?: Float32Array }
): void {
  dataset.record(
    {
      evidenceId: computeEvidenceId(input.derivationId, `shadow:${input.verdict}`),
      rubric: 'conflict',
      axis: 'epistemic',
      label: input.verdict,
      observed: input.verdict === 'support' ? 1 : 0,
      source: 'ShadowValidator',
    },
    input.embedding
  );
}

export function recordClarificationLabel(
  dataset: JudgmentDataset,
  input: { question: string; answer: string; embedding?: Float32Array }
): void {
  dataset.record(
    {
      evidenceId: computeEvidenceId(input.question, `clarification:${input.answer}`),
      rubric: 'task_type',
      axis: 'epistemic',
      label: input.answer,
      observed: 1,
      source: 'human-clarification',
    },
    input.embedding
  );
}

export interface ReactionLabelInput {
  turnId: string;
  kind: ReactionKind;
  responseDigest: string;
  correctionDigest?: string;
  responseEmbedding?: Float32Array;
  correctionEmbedding?: Float32Array;
}

/**
 * TODO24: map explicit reactions → DistillationLabels (source: REACTION_SOURCE).
 * `accept` → positive; `reject`/`abandon` → negative; `correct` → two-row
 * embedding-level preference pair (original observed: 0, correction observed: 1).
 * `clarify`/`redirect` produce metadata, not labels.
 */
export function recordReactionLabel(
  dataset: JudgmentDataset,
  input: ReactionLabelInput
): number {
  const { kind } = input;
  if (kind === 'clarify' || kind === 'redirect') return 0;
  if (kind === 'correct') {
    if (!input.correctionEmbedding) return 0;
    const pairId = computeEvidenceId(input.turnId, 'reaction-pair');
    dataset.record(
      {
        evidenceId: computeEvidenceId(pairId, 'original'),
        rubric: 'groundedness',
        axis: 'epistemic',
        label: 'corrected',
        observed: 0,
        source: REACTION_SOURCE,
      },
      input.responseEmbedding
    );
    dataset.record(
      {
        evidenceId: computeEvidenceId(pairId, 'correction'),
        rubric: 'groundedness',
        axis: 'epistemic',
        label: 'corrected',
        observed: 1,
        source: REACTION_SOURCE,
      },
      input.correctionEmbedding
    );
    return 2;
  }
  dataset.record(
    {
      evidenceId: computeEvidenceId(input.turnId, `reaction:${kind}`),
      rubric: 'groundedness',
      axis: 'epistemic',
      label: kind === 'accept' ? 'accepted' : kind === 'reject' ? 'rejected' : 'abandoned',
      observed: kind === 'accept' ? 1 : 0,
      source: REACTION_SOURCE,
    },
    input.responseEmbedding
  );
  return 1;
}
