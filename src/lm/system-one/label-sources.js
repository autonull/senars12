import { computeEvidenceId } from './distill';
import { REACTION_SOURCE } from './eval-set';
/**
 * Label-source adapters (§9.1): pipe event-sourced outcomes into the
 * append-only JudgmentDataset. Redaction-per-retention — only evidence
 * hashes and labels are stored, never raw utterance text.
 */
export function recordCorrectionLabel(dataset, input) {
    dataset.record({
        evidenceId: computeEvidenceId(input.originalNL, 'correction'),
        rubric: 'task_type',
        axis: 'epistemic',
        label: 'correction',
        source: 'FeedbackLearner.onCorrection',
    });
}
export function recordDerivationOutcomeLabel(dataset, input) {
    dataset.record({
        evidenceId: computeEvidenceId(input.ruleId, `derivation-outcome:${input.outcome}`),
        rubric: 'plausibility',
        axis: 'epistemic',
        label: input.outcome,
        source: 'FeedbackLearner.onDerivationOutcome',
    });
}
export function recordApprovalLabel(dataset, input) {
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
export function recordShadowVerdictLabel(dataset, input) {
    dataset.record({
        evidenceId: computeEvidenceId(input.derivationId, `shadow:${input.verdict}`),
        rubric: 'conflict',
        axis: 'epistemic',
        label: input.verdict,
        observed: input.verdict === 'support' ? 1 : 0,
        source: 'ShadowValidator',
    }, input.embedding);
}
export function recordClarificationLabel(dataset, input) {
    dataset.record({
        evidenceId: computeEvidenceId(input.question, `clarification:${input.answer}`),
        rubric: 'task_type',
        axis: 'epistemic',
        label: input.answer,
        observed: 1,
        source: 'human-clarification',
    }, input.embedding);
}
/**
 * TODO24: map explicit reactions → DistillationLabels (source: REACTION_SOURCE).
 * `accept` → positive; `reject`/`abandon` → negative; `correct` → two-row
 * embedding-level preference pair (original observed: 0, correction observed: 1).
 * `clarify`/`redirect` produce metadata, not labels.
 */
export function recordReactionLabel(dataset, input) {
    const { kind } = input;
    if (kind === 'clarify' || kind === 'redirect')
        return 0;
    if (kind === 'correct') {
        if (!input.correctionEmbedding)
            return 0;
        const pairId = computeEvidenceId(input.turnId, 'reaction-pair');
        dataset.record({
            evidenceId: computeEvidenceId(pairId, 'original'),
            rubric: 'groundedness',
            axis: 'epistemic',
            label: 'corrected',
            observed: 0,
            source: REACTION_SOURCE,
        }, input.responseEmbedding);
        dataset.record({
            evidenceId: computeEvidenceId(pairId, 'correction'),
            rubric: 'groundedness',
            axis: 'epistemic',
            label: 'corrected',
            observed: 1,
            source: REACTION_SOURCE,
        }, input.correctionEmbedding);
        return 2;
    }
    dataset.record({
        evidenceId: computeEvidenceId(input.turnId, `reaction:${kind}`),
        rubric: 'groundedness',
        axis: 'epistemic',
        label: kind === 'accept' ? 'accepted' : kind === 'reject' ? 'rejected' : 'abandoned',
        observed: kind === 'accept' ? 1 : 0,
        source: REACTION_SOURCE,
    }, input.responseEmbedding);
    return 1;
}
