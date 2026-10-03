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
