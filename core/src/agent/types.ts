import type { AuthManager, CommandRegistry } from '@senars/io';
import type { EpisodicMemory, LMService, NAR } from '@senars/util';
import type { ChatOptions, ChatStreamEvent } from '../ChatService.js';
/**
 * Agent public type definitions.
 */
import type { CognitiveEvent } from '../CognitiveEvent.js';
import type { Connection } from '../Transport.js';
import type { LLMCortex } from '../cortex/LLMCortex.js';
import type { Engine } from '../engine/Engine.js';
import type { CognitiveStimulus, Context, Derivation, ToolResult } from '../engine/Engine.js';
import type { EventLog } from '../eventlog/EventLog.js';
import type {
  ConversationSession,
  PersistableSessionManager,
  SessionManager,
} from '../memory/types.js';
import type { AgentCapabilities } from '../protocol/index.js';

export type { CognitiveStimulus, Context, Derivation, ToolResult };

export interface AgentOptions {
  log?: EventLog;
  id?: string;
  cortex?: LLMCortex;
  commandParser?: (text: string) => ParsedCommand[];
  builtinTools?: boolean;
  episodicMemory?: EpisodicMemory;
  sessionManager?: PersistableSessionManager;
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

export type { CognitiveEvent, ChatOptions, ChatStreamEvent, AgentCapabilities, Engine };
