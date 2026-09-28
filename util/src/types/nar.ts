/**
 * @deprecated since 0.8.0 — use `NARConfig` from `@senars/nar`. This shadow
 * declares every dependency as `unknown`, so it cannot be kept in sync with the
 * real engine and silently erases type safety at every call site. Removal is
 * scheduled for the next major.
 */
export interface NARConfig {
  lmService?: import('./llm.js').LMService;
  enableLMRules?: boolean;
  enableTools?: boolean;
  enableSelf?: boolean;
  enableRLFP?: boolean;
  rlfp?: {
    optimizeInterval?: number;
  };
  enableBidirectionalFeedback?: boolean;
  enableProactiveEnrichment?: boolean;
  enableLMStreaming?: boolean;
  persistState?: boolean;
  statePath?: string;

  cognitiveParams?: Record<string, unknown>;
  strategyRegistry?: Record<string, unknown>;
  adaptationInterval?: number;
}

/**
 * @deprecated since 0.8.0 — use the `NAR` class from `@senars/nar`. See the note
 * on {@link NARConfig}.
 */
export interface NAR {
  readonly memory: unknown;
  readonly workingMemory: unknown;
  readonly taskManager: unknown;
  readonly reasoner: unknown;
  readonly query: unknown;
  readonly traceAPI: unknown;
  readonly tools: unknown;
  readonly self?: unknown;
  readonly rlfp?: unknown;
  readonly cognitiveController?: unknown;
  readonly driveManager?: unknown;

  initialize(): Promise<void>;

  start(): Promise<void>;

  stop(): Promise<void>;

  getState(): import('./lifecycle.js').ComponentState;

  isRunning(): boolean;
}
