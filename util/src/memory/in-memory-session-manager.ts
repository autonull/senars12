import type { ConversationSession, SessionManager } from '../types/memory.js';

export function abortSession(session: ConversationSession): void {
  session.metadata.aborted = true;
  session.history = [];
}

export function createSession(key: string): ConversationSession {
  return {
    id: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    key,
    history: [],
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
    metadata: {},
  };
}

/** D15 (TODO17b): bounded runtime — sessions and per-session history are capped. */
export const DEFAULT_MAX_SESSIONS = 200;
export const DEFAULT_MAX_HISTORY_PER_SESSION = 100;

export interface InMemorySessionManagerOptions {
  maxSessions?: number;
  maxHistoryPerSession?: number;
}

export class InMemorySessionManager implements SessionManager {
  #sessions = new Map<string, ConversationSession>();
  readonly #maxSessions: number;
  readonly #maxHistory: number;

  constructor(options: InMemorySessionManagerOptions = {}) {
    this.#maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS;
    this.#maxHistory = options.maxHistoryPerSession ?? DEFAULT_MAX_HISTORY_PER_SESSION;
  }

  getOrCreate(key: string): ConversationSession {
    const existing = this.#sessions.get(key);
    if (existing) {
      existing.lastSeenAt = Date.now();
      // LRU: re-insert to mark recency (Map preserves insertion order).
      this.#sessions.delete(key);
      this.#sessions.set(key, existing);
      if (existing.history.length > this.#maxHistory) {
        existing.history.splice(0, existing.history.length - this.#maxHistory);
      }
      return existing;
    }
    const session = createSession(key);
    this.#sessions.set(key, session);
    // Evict least-recently-used session when at capacity.
    if (this.#sessions.size > this.#maxSessions) {
      const lru = this.#sessions.keys().next().value;
      if (lru !== undefined) this.#sessions.delete(lru);
    }
    return session;
  }

  size(): number {
    return this.#sessions.size;
  }
}
