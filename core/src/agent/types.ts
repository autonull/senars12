import type {
  EpisodicMemory,
  LMService,
  NAR,
  BridgeOptions as UtilBridgeOptions,
} from '@senars/util';
import type { ToolFeedbackObserver } from '@senars/util/feedback';
import type { ThreadScope } from '@senars/nar/kernel';
import type { ChatOptions, ChatStreamEvent } from '../ChatService.js';
/**
 * Agent public type definitions.
 */
import type { CognitiveEvent } from '../CognitiveEvent.js';
import type { LLMCortex } from '../cortex/LLMCortex.js';
import type {
  CognitiveStimulus,
  Context,
  Derivation,
  Engine,
  ToolResult,
} from '../engine/Engine.js';
import type { EventLog } from '../eventlog/EventLog.js';
import type {
  ConversationSession,
  PersistableSessionManager,
  SessionManager,
} from '../memory/types.js';
import type { PinStore } from '../motor/builtin-tools.js';
import type { AgentCapabilities } from '../protocol/index.js';
import type { Connection } from '../Transport.js';
import type { MacroPhase } from './pipeline.js';

export type { CognitiveStimulus, Context, Derivation, ToolResult };

export interface AgentOptions {
  log?: EventLog;
  id?: string;
  cortex?: LLMCortex;
  commandParser?: (text: string) => ParsedCommand[];
  builtinTools?: boolean;
  episodicMemory?: EpisodicMemory;
  /** Evaluate a MeTTa expression; backs the `metta` builtin tool. */
  mettaExecutor?: (expression: string) => Promise<unknown[]>;
  /** Key/value pin store; backs the `pin` builtin tool. */
  pinStore?: PinStore;
  sessionManager?: PersistableSessionManager;
  /** Shared feedback observer for unified tool statistics. */
  feedbackObserver?: ToolFeedbackObserver;
  /** System One egress gate: returns true (or `{grounded, score}`) when a narration draft is grounded enough to emit. */
  groundednessGate?: (narration: string, correlationId: string) => Promise<boolean | { grounded: boolean; score?: number }>;
  /** E4 agent-trace grading: grades the completed cycle's narration + executed tools into the distillation dataset. */
  traceGrader?: (trace: {
    narration: string;
    toolCalls: readonly { command: string; success: boolean }[];
    correlationId: string;
  }) => Promise<unknown>;
  /** H2: default narration tier for chat cycles when the caller passes none. */
  narrateTier?: 'quality' | 'fast' | 'structured';
  /** Phase A (REFACTOR.todo1): custom macro-cycle phases; default `DEFAULT_MACRO_PIPELINE`. */
  macroPipeline?: MacroPhase[];
  /** Phase A (REFACTOR.todo2): end-of-cycle learning consolidation (pressure-gated, inert below threshold). */
  consolidateLearning?: (options: { budget?: number }) => Promise<void>;
  /** Consolidation config: enabled by default, optional per-invocation budget. */
  consolidation?: { enabled?: boolean; budget?: number };
  /** Phase A (REFACTOR.todo4): per-correlationId scope for ContrastiveMemory isolation. */
  threadScope?: ThreadScope;
}

export interface ParsedCommand {
  command: string;
  args: string[];
  raw: string;
}

export type AgentPresetName = 'chat' | 'reasoning' | 'autonomous' | 'irc-bot';

export interface AgentPresetDeps {
  nar?: NAR;
  lmService?: LMService;
  episodicMemory?: EpisodicMemory;
  logger?: {
    debug: (msg: string, ...args: unknown[]) => void;
    info: (msg: string, ...args: unknown[]) => void;
    warn: (msg: string, ...args: unknown[]) => void;
    error: (msg: string, ...args: unknown[]) => void;
  };
  externalTools?: Record<string, unknown>;
  workspaceRoot?: string;
}

export interface AgentPresetResult {
  agent: import('../Agent.js').Agent;
  config: Partial<AgentOptions>;
}

export type ValidatedAgentOptions = Required<Pick<AgentOptions, 'cortex'>> & AgentOptions;

/** Refines the canonical util contract with core-owned memory typing; the auth/commandRegistry
 *  shape lives in util (`BridgeAuthHandler`) so core never imports io. */
export interface BridgeOptions extends UtilBridgeOptions {
  episodicMemory?: EpisodicMemory;
}

export interface BridgeContext {
  connection: Connection;
  nar: NAR;
  respond: (text: string) => Promise<void>;
  session?: ConversationSession;
}

export interface HealthStatus {
  readonly status: 'healthy' | 'degraded' | 'stuck' | 'crashed';
  readonly lastCycle: number;
  readonly cycleCount: number;
  readonly errorRate: number;
}

export interface SkillDefinition {
  readonly name: string;
  readonly description?: string;

  execute(...args: unknown[]): unknown;
}

export type { AgentCapabilities, ChatOptions, ChatStreamEvent, CognitiveEvent, Engine };
