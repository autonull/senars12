import type { SessionManager } from '@senars/util/types/memory';

export interface MemoryEntry {
  readonly id: string;
  readonly type: string;
  readonly payload: unknown;
  readonly timestamp: number;
  readonly correlationId?: string;
}

export interface MemoryQuery {
  readonly type?: string;
  readonly limit?: number;
  readonly from?: number;
  readonly to?: number;
}

export type { Episode } from '@senars/util';
export type { ConversationSession, SessionManager } from '@senars/util/types/memory';

export interface PersistableSessionManager extends SessionManager {
  restore(): Promise<void>;

  snapshot(): Promise<void>;
}

export interface AgentToolDeps {
  know: (key: string, value: string) => void;
  knowGet: (key: string) => string | undefined;
  knowList: () => Array<{ key: string; value: string }>;
  recall: (query?: string, limit?: number) => Promise<unknown[]>;
  setInstructions?: (mode: 'append' | 'replace', instructions: string) => void;
  getSessionInfo?: () => { messageCount: number; createdAt: number; pinnedBeliefs: unknown[] };
  /** Run a prompt in a short-lived sub-agent worker and return its final text. */
  delegate?: (prompt: string) => Promise<string>;
}
