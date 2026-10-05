import type { SessionManager } from '@senars/util/types/memory';

/**
 * How much recent context an utterance is given. One window for both tiers it is
 * read from — the working tier and the episodic tail beside it — because they are
 * assembled into the same prompt: the two were separate `50`s, and only one of
 * them was ever a cap. Episodic recall is context, not an audit log, so the
 * episodic read is bounded to the same window rather than to whatever the log
 * happens to hold.
 */
export const RECALL_WINDOW = 50;

/** Hard ceiling on the working tier; the oldest entry is evicted past it. */
export const WORKING_MEMORY_CAPACITY = 1000;

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
