import type { ConversationSession, SessionManager } from '../types/memory.js';
import { trimCapped } from '../utils/collections.js';
import { generateId } from '../utils/id.js';
import { LruCache } from '../utils/lru-cache.js';

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

export interface SessionStoreOptions {
  maxSessions?: number;
  maxHistoryPerSession?: number;
}

/**
 * Bounded session map — the single runtime store behind every `SessionManager`,
 * in-memory or persistent. A long-running agent creates a session per
 * conversation, so the store is the AIKR boundary that keeps the working set
 * finite: LRU sessions, trimmed per-session history.
 */
export class SessionStore {
  readonly #sessions: LruCache<string, ConversationSession>;
  readonly #maxHistory: number;

  constructor(options: SessionStoreOptions = {}) {
    this.#maxHistory = options.maxHistoryPerSession ?? DEFAULT_MAX_HISTORY_PER_SESSION;
    this.#sessions = new LruCache({ maxSize: options.maxSessions ?? DEFAULT_MAX_SESSIONS });
  }

  get maxSessions(): number {
    return this.#sessions.maxSize;
  }

  size(): number {
    return this.#sessions.size();
  }

  /** Live sessions, least-recently-used first. */
  *values(): Generator<ConversationSession> {
    yield* this.#sessions.values();
  }

  /** Adopt a session (persistence replay), subject to the same bounds. */
  load(key: string, session: ConversationSession): ConversationSession {
    this.#trim(session);
    this.#sessions.set(key, session);
    return session;
  }

  getOrCreate(key: string): ConversationSession {
    const existing = this.#sessions.get(key);
    if (existing) {
      existing.lastSeenAt = Date.now();
      this.#trim(existing);
      return existing;
    }
    return this.load(key, createSession(key));
  }

  clear(): void {
    this.#sessions.clear();
  }

  #trim(session: ConversationSession): void {
    trimCapped(session.history, this.#maxHistory);
  }
}

/** Sessions with no persistence layer. */
export class InMemorySessionManager implements SessionManager {
  readonly #store: SessionStore;

  constructor(options: SessionStoreOptions = {}) {
    this.#store = new SessionStore(options);
  }

  getOrCreate(key: string): ConversationSession {
    return this.#store.getOrCreate(key);
  }

  size(): number {
    return this.#store.size();
  }
}
