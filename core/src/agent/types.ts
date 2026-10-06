import type {
  AgentOptions as UtilAgentOptions,
  EpisodicMemory,
  GroundednessGate,
  HealthStatus,
  LMTask,
  ParsedCommand,
  SkillDefinition,
  TraceGrader,
  BridgeOptions as UtilBridgeOptions,
} from '@senars/util';
import type { ToolFeedbackObserver } from '@senars/util/feedback';
import type { ChatOptions, ChatStreamEvent } from '../chat.js';
/**
 * Agent public type definitions.
 */

/**
 * Per-correlationId scope store (Phase A) — the contract that keeps one user's
 * context from bleeding into another's. `nar` holds the LRU-backed
 * implementation; `core` only needs to name the reader.
 */
export interface CorrelationScopeStore {
  get(correlationId: string): { contrastiveMemory?: object; sourceKey?: string };
}

import type { LLMCortex } from '../cortex/LLMCortex.js';
import type {
  CognitiveStimulus,
  Context,
  Derivation,
  Engine,
  ToolResult,
} from '../engine/Engine.js';
import type { EventLog } from '../eventlog/EventLog.js';
import type { PersistableSessionManager } from '../memory/types.js';
import type { PinStore } from '../motor/builtin-tools.js';
import type { AgentCapabilities } from '../protocol/index.js';
import type { CognitiveEvent } from '../schemas/index.js';
import type { MacroPhase } from './pipeline.js';

/** `util` owns the shape; re-exported so `core` importers keep one spelling. */
export type { CognitiveStimulus, Context, Derivation, ParsedCommand, ToolResult };

export interface AgentOptions extends UtilAgentOptions {
  log?: EventLog;
  cortex?: LLMCortex;
  episodicMemory?: EpisodicMemory;
  /** Evaluate a MeTTa expression; backs the `metta` builtin tool. */
  mettaExecutor?: (expression: string) => Promise<unknown[]>;
  /** Key/value pin store; backs the `pin` builtin tool. */
  pinStore?: PinStore;
  sessionManager?: PersistableSessionManager;
  /** Shared feedback observer for unified tool statistics. */
  feedbackObserver?: ToolFeedbackObserver;
  /** System One egress gate: returns true (or `{grounded, score}`) when a narration draft is grounded enough to emit. */
  groundednessGate?: GroundednessGate;
  /** E4 agent-trace grading: grades the completed cycle's narration + executed tools into the distillation dataset. */
  traceGrader?: TraceGrader;
  /** H2: default narration tier for chat cycles when the caller passes none. */
  narrateTier?: LMTask;
  /** Phase A (REFACTOR.todo1): custom macro-cycle phases; default `DEFAULT_MACRO_PIPELINE`. */
  macroPipeline?: MacroPhase[];
  /** Phase A (REFACTOR.todo2): end-of-cycle learning consolidation (pressure-gated, inert below threshold). */
  consolidateLearning?: (options: { budget?: number }) => Promise<void>;
  /** Consolidation config: enabled by default, optional per-invocation budget. */
  consolidation?: { enabled?: boolean; budget?: number };
  /** Phase A (REFACTOR.todo4): per-correlationId scope for ContrastiveMemory isolation. */
  threadScope?: CorrelationScopeStore;
}

/** Options once the cortex has been resolved from a service. `util`'s
 *  `ValidatedAgentOptions` is the *validated config* type — a different record
 *  that had taken this name on `core`'s public surface. */
export type ResolvedAgentOptions = Required<Pick<AgentOptions, 'cortex'>> & AgentOptions;

/** Refines the canonical util contract with core-owned memory typing; the auth/commandRegistry
 *  shape lives in util (`BridgeAuthHandler`) so core never imports io. */
export interface BridgeOptions extends UtilBridgeOptions {
  episodicMemory?: EpisodicMemory;
}

export type {
  AgentCapabilities,
  ChatOptions,
  ChatStreamEvent,
  CognitiveEvent,
  Engine,
  HealthStatus,
  SkillDefinition,
};
