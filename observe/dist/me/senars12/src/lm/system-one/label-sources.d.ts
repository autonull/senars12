import type { ReactionKind } from '../../dialogue/types';
import { type JudgmentDataset } from './distill';
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
export declare function recordCorrectionLabel(dataset: JudgmentDataset, input: CorrectionLabelInput): void;
export declare function recordDerivationOutcomeLabel(dataset: JudgmentDataset, input: DerivationOutcomeLabelInput): void;
export declare function recordApprovalLabel(dataset: JudgmentDataset, input: {
    action: string;
    approved: boolean;
    embedding?: Float32Array;
    predicted?: number;
}): void;
export declare function recordShadowVerdictLabel(dataset: JudgmentDataset, input: {
    derivationId: string;
    verdict: 'support' | 'conflict';
    embedding?: Float32Array;
}): void;
export declare function recordClarificationLabel(dataset: JudgmentDataset, input: {
    question: string;
    answer: string;
    embedding?: Float32Array;
}): void;
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
export declare function recordReactionLabel(dataset: JudgmentDataset, input: ReactionLabelInput): number;
//# sourceMappingURL=label-sources.d.ts.map