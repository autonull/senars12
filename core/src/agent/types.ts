import type { AuthManager, CommandRegistry } from '@senars/io';
import type { EpisodicMemory, LMService, NAR } from '@senars/util';
import type { ToolFeedbackObserver } from '@senars/util/feedback';
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
  /** System One egress gate: returns true when a narration draft is grounded enough to emit. */
  groundednessGate?: (narration: string) => Promise<boolean>;
  /** E4 agent-trace grading: grades the completed cycle's narration + executed tools into the distillation dataset. */
  traceGrader?: (trace: {
    narration: string;
    toolCalls: readonly { command: string; success: boolean }[];
    correlationId: string;
  }) => Promise<unknown>;
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

export interface BridgeOptions {
  auth?: AuthManager;
  commandRegistry?: CommandRegistry;
  sessionManager?: SessionManager;
  episodicMemory?: EpisodicMemory;
  generationService?: unknown;
  understandingService?: unknown;
  manager?: unknown;
  enableNarseseHumanization?: boolean;
  enableNarsTrace?: boolean;
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
