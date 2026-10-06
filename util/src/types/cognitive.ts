import { z } from 'zod';
import type { BeliefTruth } from './truth.js';
/**
 * Every origin a cognitive event may claim. One list, so the zod boundary in
 * `core` cannot admit an origin the types do not carry — the gates mint
 * `kernel` events and System One mints `proposer` ones, and the schema said so
 * while `EngineOrigin` did not.
 */
export const ENGINE_ORIGINS = ['nar', 'kernel', 'proposer'] as const;

export type EngineOrigin = (typeof ENGINE_ORIGINS)[number];

/**
 * Bands, most permissive first. `abstain` is below `block` rather than beside it,
 * so the ordinal alone makes abstaining the most restrictive answer.
 */
export const BANDS = { act: 2, review: 1, block: 0, abstain: -1 } as const;

export type BandDecision = keyof typeof BANDS;

export const BandDecisionSchema = z.enum(Object.keys(BANDS) as [BandDecision, ...BandDecision[]]);

/** How restrictive a band is; abstaining is always the most restrictive. */
export const bandOrdinal = (band: BandDecision): number => BANDS[band];

/** Whether a judgment is about what is true or what is wanted. */
export const COGNITIVE_AXES = ['epistemic', 'teleological'] as const;

export type CognitiveAxis = (typeof COGNITIVE_AXES)[number];

export const CognitiveAxisSchema = z.enum(COGNITIVE_AXES);

/**
 * The query shapes a judgment can take, as `JudgmentQuery` declares them.
 *
 * `synthesize` was missing from the event's own enum while being a declared query
 * kind, so recording a resolved synthesis — `shape: proposition.kind` passes
 * whatever the proposition says — was an append that threw.
 */
export const JUDGMENT_SHAPES = ['classify', 'evaluate', 'synthesize'] as const;

export const JudgmentShapeSchema = z.enum(JUDGMENT_SHAPES);

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
 * What the egress gate decided about a narration draft: emit it, or fall back.
 * The score is the head's confidence in the groundedness call and is absent when
 * the gate answered on a rule rather than on a calibrated head.
 */
export interface EgressVerdict {
  readonly grounded: boolean;
  readonly score?: number;
}

/**
 * The System One egress gate. Answers `true` for a gate that carries no score, so
 * a boolean-only gate is still a gate — the verdict normalises it at the boundary.
 */
export type GroundednessGate = (
  narration: string,
  correlationId: string
) => Promise<boolean | EgressVerdict>;

/** Narrow a gate's answer to the one shape every consumer downstream expects. */
export const egressVerdict = (answer: boolean | EgressVerdict): EgressVerdict =>
  typeof answer === 'boolean' ? { grounded: answer } : answer;

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
