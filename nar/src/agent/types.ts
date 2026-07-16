import type { NAR } from '../nar.js';
import type { LMService } from '../lm/lm-service.js';
import type { EpisodicMemory, Episode } from '../memory/EpisodicMemory.js';
import type { ChatOptions, ChatStreamEvent } from '@senars/core';

export interface ConversationSession {
  id: string;
  key: string;
  history: Array<{ role: 'user' | 'agent' | 'system'; content: string; timestamp: number }>;
  createdAt: number;
  lastSeenAt: number;
  metadata: Record<string, unknown>;
}

export interface AgentToolDeps {
  know: (key: string, value: string) => void;
  knowGet: (key: string) => string | undefined;
  knowList: () => Array<{ key: string; value: string }>;
  recall: (query?: string, limit?: number) => Promise<Episode[]>;
  setInstructions?: (mode: 'append' | 'replace', instructions: string) => void;
  getSessionInfo?: () => { messageCount: number; createdAt: number; pinnedBeliefs: unknown[] };
}

export interface AgentOptions {
  nar?: NAR;
  lmService?: LMService;
  episodicMemory?: EpisodicMemory;
  logger?: { debug: (msg: string, ...args: unknown[]) => void; info: (msg: string, ...args: unknown[]) => void; warn: (msg: string, ...args: unknown[]) => void; error: (msg: string, ...args: unknown[]) => void };
  autonomyEngine?: { start: () => void; stop: () => void; setNotifyHandler: (h: (msg: string) => void) => void };
  externalTools?: Record<string, unknown>;
  workspaceRoot?: string;
  throttle?: number;
  knowStore?: Map<string, string>;
  enableNarseseHumanization?: boolean;
  enableNarsTrace?: boolean;
}

export type AgentPresetName = 'chat' | 'reasoning' | 'autonomous' | 'irc-bot';

export interface AgentPresetDeps {
  nar?: NAR;
  lmService?: LMService;
  episodicMemory?: EpisodicMemory;
  logger?: AgentOptions['logger'];
  externalTools?: Record<string, unknown>;
  workspaceRoot?: string;
}

export interface AgentPresetResult {
  agent: Agent;
  config: Partial<AgentOptions>;
}

export type ValidatedAgentOptions = Required<Pick<AgentOptions, 'nar' | 'lmService' | 'episodicMemory'>> & AgentOptions;

export interface BridgeOptions {
  auth?: import('@senars/io').AuthManager;
  commandRegistry?: import('@senars/io').CommandRegistry;
  sessionManager?: SessionManager;
  episodicMemory?: EpisodicMemory;
  generationService?: unknown;
  understandingService?: unknown;
  manager?: unknown;
  enableNarseseHumanization?: boolean;
  enableNarsTrace?: boolean;
}

export interface BridgeContext {
  connection: import('@senars/core').Connection;
  nar: NAR;
  respond: (text: string) => Promise<void>;
  session?: ConversationSession;
}

export interface SessionManager {
  getOrCreate(key: string): ConversationSession;
  size(): number;
}

export interface Agent {
  chat(text: string, opts?: { stream?: boolean; session?: ConversationSession; signal?: AbortSignal }): Promise<string> | AsyncGenerator<ChatStreamEvent, string>;
  chatStream(text: string, opts?: ChatOptions & { session?: ConversationSession }): AsyncGenerator<ChatStreamEvent, string>;
  believe(text: string): Promise<void>;
  recall(query?: string, limit?: number): Promise<Episode[]>;
  know(key: string, value: string): void;
  knowGet(key: string): string | undefined;
  knowList(): Array<{ key: string; value: string }>;
  setThrottle(n: number): void;
  getThrottle(): number;
  getNAR(): NAR | undefined;
  getEpisodicMemory(): EpisodicMemory | undefined;
  getRecentDerivations(): unknown[];
  start(): () => void;
  stop(): void;
}
