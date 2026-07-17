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

export interface Episode {
  timestamp: number;
  type: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface ConversationSession {
  id: string;
  key: string;
  history: Array<{ role: 'user' | 'agent' | 'system'; content: string; timestamp: number }>;
  createdAt: number;
  lastSeenAt: number;
  metadata: Record<string, unknown>;
}

export interface SessionManager {
  getOrCreate(key: string): ConversationSession;
  size(): number;
}

export interface JsonlSessionManagerConfig {
  basePath: string;
}

export interface AgentToolDeps {
  know: (key: string, value: string) => void;
  knowGet: (key: string) => string | undefined;
  knowList: () => Array<{ key: string; value: string }>;
  recall: (query?: string, limit?: number) => Promise<unknown[]>;
  setInstructions?: (mode: 'append' | 'replace', instructions: string) => void;
  getSessionInfo?: () => { messageCount: number; createdAt: number; pinnedBeliefs: unknown[] };
}