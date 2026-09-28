import { generateId } from '../utils/shared.js';
import { LruCache } from '../utils/lru-cache.js';
import type { ConversationSession, SessionManager } from '../types/memory.js';

export function abortSession(session: ConversationSession): void {
  session.metadata.aborted = true;
  session.history = [];
}

export function createSession(key: string): ConversationSession {
  return {
    id: generateId('sess'),
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
  #sessions: LruCache<string, ConversationSession>;
  readonly #maxSessions: number;
  readonly #maxHistory: number;

  constructor(options: InMemorySessionManagerOptions = {}) {
    this.#maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS;
    this.#maxHistory = options.maxHistoryPerSession ?? DEFAULT_MAX_HISTORY_PER_SESSION;
    this.#sessions = new LruCache({ maxSize: this.#maxSessions });
  }

  getOrCreate(key: string): ConversationSession {
    const existing = this.#sessions.get(key);
    if (existing) {
      existing.lastSeenAt = Date.now();
      this.#sessions.set(key, existing);
      if (existing.history.length > this.#maxHistory) {
        existing.history.splice(0, existing.history.length - this.#maxHistory);
      }
      return existing;
    }
    const session = createSession(key);
    this.#sessions.set(key, session);
    return session;
  }

  size(): number {
    return this.#sessions.size;
  }
}
