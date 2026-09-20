import { computeEvidenceId, type JudgmentDataset } from './distill.js';

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
  dataset.record({
    evidenceId: computeEvidenceId(input.action, `approval:${input.approved ? 'approved' : 'rejected'}`),
    rubric: 'risk',
    axis: 'teleological',
    label: input.approved ? 'approved' : 'rejected',
    score: input.predicted,
    observed: input.approved ? 1 : 0,
    source: 'ApprovalService',
  }, input.embedding);
}

export function recordShadowVerdictLabel(
  dataset: JudgmentDataset,
  input: { derivationId: string; verdict: 'support' | 'conflict'; embedding?: Float32Array }
): void {
  dataset.record({
    evidenceId: computeEvidenceId(input.derivationId, `shadow:${input.verdict}`),
    rubric: 'conflict',
    axis: 'epistemic',
    label: input.verdict,
    observed: input.verdict === 'support' ? 1 : 0,
    source: 'ShadowValidator',
  }, input.embedding);
}

export function recordClarificationLabel(
  dataset: JudgmentDataset,
  input: { question: string; answer: string; embedding?: Float32Array }
): void {
  dataset.record({
    evidenceId: computeEvidenceId(input.question, `clarification:${input.answer}`),
    rubric: 'task_type',
    axis: 'epistemic',
    label: input.answer,
    observed: 1,
    source: 'human-clarification',
  }, input.embedding);
}
