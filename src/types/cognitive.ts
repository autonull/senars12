import { z } from 'zod';
import type { BeliefTruth } from './truth.js';
import {
  ENGINE_ORIGINS,
  type EngineOrigin,
  PROPOSER_ORIGIN,
  NAR_ORIGIN,
} from '../util/origins.js';
import {
  BANDS,
  type BandDecision,
  BandDecisionSchema,
  bandOrdinal,
  COGNITIVE_AXES,
  type CognitiveAxis,
  CognitiveAxisSchema,
  JUDGMENT_SHAPES,
  JudgmentShapeSchema,
  egressVerdict,
  type EgressVerdict,
} from '../util/cognitive-schemas.js';

export { BANDS, type BandDecision, BandDecisionSchema, bandOrdinal };
export { COGNITIVE_AXES, type CognitiveAxis, CognitiveAxisSchema };
export { JUDGMENT_SHAPES, JudgmentShapeSchema };
export { egressVerdict, type EgressVerdict };

export interface CognitiveStimulus {
  text: string;
  source: string;
  timestamp: number;
  correlationId: string;
}

export interface Context {
  working: unknown[];
  episodic: unknown[];
  semantic: unknown[];
}

export interface Derivation {
  term: string;
  truth?: BeliefTruth;
  timestamp: number;
}

export interface ChatOptions {
  readonly signal?: AbortSignal;
  readonly sessionId?: string;
  readonly stream?: boolean;
}

/**
 * The System One egress gate. Answers `true` for a gate that carries no score, so
 * a boolean-only gate is still a gate — the verdict normalises it at the boundary.
 */
export type GroundednessGate = (
  narration: string,
  correlationId: string
) => Promise<boolean | EgressVerdict>;

/** One tool the agent executed during a cycle, as the trace grader sees it. */
export interface TracedToolCall {
  readonly command: string;
  readonly success: boolean;
}

/**
 * One completed agent cycle, handed to a trace grader at end-of-cycle.
 *
 * Declared once because four sites had their own copy of this record and they
 * drifted: the `AgentOptions` spelling had lost `egress`, so a grader wired
 * through the options silently stopped receiving the groundedness ground truth
 * that the `CycleHost` spelling still passed. `correlationId` is required rather
 * than optional because the cycle host always has one, and a grader keying a
 * trajectory store on it had to spell `?? ''` at two call sites to accept a
 * record the producer could not actually omit.
 */
export interface AgentTrace {
  readonly narration: string;
  readonly toolCalls: readonly TracedToolCall[];
  readonly correlationId: string;
  /** Egress-gate verdict — ground truth for the groundedness rubric. */
  readonly egress?: EgressVerdict;
}

/** Grades one completed cycle into a dataset; the return value is the grader's own. */
export type TraceGrader = (trace: AgentTrace) => Promise<unknown>;

export interface ChatStreamEvent {
  readonly kind: 'text-delta' | 'tool-call' | 'tool-result' | 'finish' | 'error' | 'aborted';
  readonly text?: string;
  readonly toolName?: string;
  readonly toolArgs?: unknown;
  readonly toolResult?: unknown;
  readonly error?: string;
  /** The correlationId minted for this message (on `finish`), joining turns ↔ trace grades ↔ episodes. */
  readonly correlationId?: string;
}
