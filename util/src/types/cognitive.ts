import type { BeliefTruth } from './truth.js';
/**
 * Every origin a cognitive event may claim. One list, so the zod boundary in
 * `core` cannot admit an origin the types do not carry — the gates mint
 * `kernel` events and System One mints `proposer` ones, and the schema said so
 * while `EngineOrigin` did not.
 */
export const ENGINE_ORIGINS = ['nar', 'kernel', 'proposer'] as const;

export type EngineOrigin = (typeof ENGINE_ORIGINS)[number];

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
  truth?: { frequency: number; confidence: number };
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
