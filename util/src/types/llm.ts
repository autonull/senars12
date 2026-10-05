import type { LanguageModel } from 'ai';

import { type CallTally, createCallTally, recordCall } from '../utils/tally.js';

/**
 * The LM tiers, and the one list they are enumerated from — every column of the
 * model matrix, every key of the routing table, and every tier the CLI, the
 * doctor and the MCP resource report.
 *
 * `compact` was the fourth tier the model factory had been building and the
 * routing table could not name. `LMTask` said three, `model-factory.ts`
 * registered `cloud:compact` / `llamacpp:compact` / `llamacpp-embedded:compact`
 * / `webllm:compact` / `builtin:compact` anyway, and `CHAINS` — typed
 * `Record<LMTask, …>`, so it was *required* to be exhaustive — therefore had no
 * rung for it. Asking for a compact model threw out of `getModelChain`, was
 * swallowed by `LMService.getModel`'s bare `catch`, and reached the operator as
 * "no model for that tier" while `senars.config.json` sat there configuring
 * `compactModel`. The sites that had noticed the fourth tier each invented a way
 * to say it: `LMTask | 'compact'` in three signatures in `embedded-llamacpp.ts`,
 * and an `as never` in the MCP resource that silenced the type error the cast was
 * standing on top of.
 *
 * One list, one derived type, and `Record<LMTask, …>` goes back to meaning
 * "one rung per tier the factory builds".
 */
export const LM_TASKS = ['quality', 'fast', 'structured', 'compact'] as const;

export type LMTask = (typeof LM_TASKS)[number];

/** A {@link CallTally} plus the token count — what every LM path accumulates. */
export interface LMExecutionStats extends CallTally {
  totalTokens: number;
}

export const createLMStats = (): LMExecutionStats => ({ ...createCallTally(), totalTokens: 0 });

/** Fold one LM attempt into `stats` — the `recordCall` counters plus the tokens it spent. */
export const recordLMCall = (
  stats: LMExecutionStats,
  success: boolean,
  durationMs: number,
  tokens = 0
): void => {
  recordCall(stats, success, durationMs);
  stats.totalTokens += tokens;
};

/** The single per-call generation option bag — shared by every LM service interface. */
export interface LMGenerateOptions {
  task?: LMTask;
  signal?: AbortSignal;
  temperature?: number;
  maxOutputTokens?: number;
  /** Explicit per-call model id (e.g. 'cloud:quality') — bypasses the routing chain. */
  model?: string;
  /** GBNF grammar for constrained decoding. */
  grammar?: string;
}

export interface LMService {
  readonly provider: string | undefined;
  readonly model: string | undefined;
  readonly available: boolean;

  getModel(task: LMTask): LanguageModel | undefined;

  hasModel(): boolean;

  getStats(): LMExecutionStats;

  generateText(prompt: string, opts?: LMGenerateOptions): Promise<string>;

  generateObject<T>(
    prompt: string,
    schema: unknown,
    opts?: {
      task?: LMTask;
      signal?: AbortSignal;
    }
  ): Promise<T>;

  stream(
    prompt: string,
    opts?: {
      task?: LMTask;
      signal?: AbortSignal;
    }
  ): AsyncIterable<string>;
}

/**
 * The three states a provider circuit can be in, and the one list they are
 * enumerated from. It lived in nar's circuit breaker while `ModelRuleStats`
 * below and the prometheus gauge each re-spelled it; a leaf union is what makes
 * one breaker reportable from every layer.
 */
export const CIRCUIT_STATES = ['closed', 'open', 'half-open'] as const;

export type CircuitState = (typeof CIRCUIT_STATES)[number];

export type ModelRuleStats = {
  id: string;
  name: string;
  enabled: boolean;
  stats: LMExecutionStats;
  circuitState: CircuitState;
};

export type LMRuleConfig = {
  id?: string;
  name?: string;
  description?: string;
  category?: string;
  priority?: number;
  enabled?: boolean;
  singlePremise?: boolean;
  promptTemplate?:
    | string
    | ((primary: unknown, secondary?: unknown, context?: Record<string, unknown>) => string);
  responseProcessor?: (
    response: unknown,
    primary: unknown,
    secondary?: unknown,
    context?: Record<string, unknown>
  ) => unknown;
  taskGenerator?: (
    processed: unknown,
    primary: unknown,
    secondary?: unknown,
    context?: Record<string, unknown>
  ) => unknown[];
  activationCondition?: (
    primary: unknown,
    secondary?: unknown,
    context?: Record<string, unknown>
  ) => boolean;
  lmOptions?: {
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
  };
  /** GBNF grammar for constrained decoding (llamacpp provider). */
  grammar?: string;
  /**
   * The bound on one provider call this rule makes. A rule without one hangs its
   * caller forever on a provider that never answers, which is how a model ended
   * up inside a cycle meant to close in microseconds (TODO29.a §5.1 step 7).
   */
  callTimeoutMs?: number;
  maxOutputTokens?: number;
  /** Pure-NAL symbolic fallback: null skips the rule, [] degrades silently. */
  fallback?: (
    primary: unknown,
    secondary?: unknown,
    context?: Record<string, unknown>
  ) => unknown[] | null;
};

export type LMPromptGenerator = (
  primary: unknown,
  secondary?: unknown,
  context?: Record<string, unknown>
) => string;
export type LMResponseProcessor = (
  response: unknown,
  primary: unknown,
  secondary?: unknown,
  context?: Record<string, unknown>
) => unknown;
export type LMTaskGenerator = (
  processed: unknown,
  primary: unknown,
  secondary?: unknown,
  context?: Record<string, unknown>
) => unknown[];

export interface MockLMConfig {
  generateTextFn?: (prompt: string) => string | Promise<string>;
  generateObjectFn?: <T>(prompt: string, schema: unknown) => T | Promise<T>;
  available?: boolean;
  provider?: string;
  model?: string;
}
