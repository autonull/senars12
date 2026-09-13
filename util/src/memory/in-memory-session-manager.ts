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

export class InMemorySessionManager implements SessionManager {
  #sessions = new Map<string, ConversationSession>();

  getOrCreate(key: string): ConversationSession {
    const existing = this.#sessions.get(key);
    if (existing) {
      existing.lastSeenAt = Date.now();
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
