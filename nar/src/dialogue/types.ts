/**
 * Dialogue Flywheel types (TODO24). Leaf module — type-only imports, no
 * circular deps. All at-rest payloads are hash-only (I6): raw conversational
 * text never persists; content survives as sha256 digests + embeddings.
 */
import type { FormalizationCandidate } from '@senars/kernel/schemas';
import type { JudgmentProvenance } from '../lm/system-one/decide.js';

export type ReactionKind = 'accept' | 'correct' | 'reject' | 'clarify' | 'redirect' | 'abandon';

export interface Reaction {
  kind: ReactionKind;
  /** sha256 of corrected text (I6: no raw text at rest). */
  correctionDigest?: string;
  /** Embedded at bind time, before discard (I6). */
  correctionEmbedding?: Float32Array;
  at: number;
  /** The turn this reaction responds to. */
  turnId: string;
}

export interface DialogueTurn {
  /** = correlationId of the first message of the conversation (I7). */
  sessionId: string;
  /** = correlationId of this message + seq (unique per exchange). */
  turnId: string;
  seq: number;

  // Exchange content (hash-only — I6)
  utteranceDigest?: string;
  responseDigest?: string;
  /** evidenceId of the embedding in the vector sidecar. */
  responseEmbedding?: string;

  // Reasoning artifacts (references, not copies — populated incrementally)
  formalizations?: readonly FormalizationCandidate[];
  judgment?: { abstained: boolean; band: string };
  grounding?: { admitted: boolean; score: number };
  reflex?: { proposed: readonly string[]; selected: string; vetoes: number };

  /** Provenance (I4) — set at capture; reactions join by turnId at read time. */
  provenance?: JudgmentProvenance;
  reaction?: Reaction;
}

export interface CorrectionAnalysis {
  turnId: string;
  originalDigest: string;
  correctionDigest?: string;
  /** Re-used for contrastive mining without re-embedding. */
  correctionEmbedding?: Float32Array;
  reaction: Reaction;
}

export interface StrategyAuditEntry {
  strategy: string;
  gradedTurns: number;
  meanQuality: number;
  /** Phase B (REFACTOR.todo1): parameter/strategy changes in the session window. */
  parameterChanges?: Array<{
    parameter: string;
    oldValue: number | string;
    newValue: number | string;
    at: number;
    trigger?: string;
  }>;
}

/** Causal edge rendered from episode `causes`/`consequences` (REFACTOR.todo2 Phase A). */
export interface CausalChainEdge {
  /** Upstream episode/turn id the reaction cites as its cause. */
  from: string;
  /** The reacting episode's id (downstream). */
  to: string;
  kind: ReactionKind;
  at: number;
}

export interface Retrospective {
  version: 'retrospective-v1';
  sessionId: string;
  at: number;
  turnCount: number;
  reactionCount: number;
  reactionDistribution: Record<ReactionKind, number>;
  corrections: CorrectionAnalysis[];
  contradictions: string[];
  strategyAudit: StrategyAuditEntry[];
  proposals: readonly unknown[];
  /** Phase A (REFACTOR.todo2): causes edges of the session's reactions, upstream-first, chronological. */
  causalChains?: readonly CausalChainEdge[];
  /** Phase C (REFACTOR.todo2): cross-memory context around the session window (MemoryQuery consumer). */
  sessionContext?: readonly string[];
  /** Which turns were consolidated (I4). */
  provenance: { turnIds: readonly string[] };
  /** Digest pin over consolidated turn ids + distributions (fail-closed on load). */
  digest: string;
}

export interface Lesson {
  /** Narsese self-belief term. */
  term: string;
  truth: { frequency: number; confidence: number };
  /** 'retrospect' = session consolidation; 'reaction' = DQ6 formalized correction (bound at bindReaction). */
  source: 'retrospect' | 'reaction';
  provenance: { turnIds: readonly string[] };
}

export const REACTION_KINDS: readonly ReactionKind[] = [
  'accept',
  'correct',
  'reject',
  'clarify',
  'redirect',
  'abandon',
];

export const emptyReactionDistribution = (): Record<ReactionKind, number> =>
  Object.fromEntries(REACTION_KINDS.map((k) => [k, 0])) as Record<ReactionKind, number>;
