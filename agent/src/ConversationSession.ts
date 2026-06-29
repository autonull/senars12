export interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ConversationSession {
  readonly key: string;
  history: SessionMessage[];
  pinnedBeliefs: string[];
  createdAt: number;
  lastSeenAt: number;
}

export const DEFAULT_SESSION_HISTORY_LIMIT = 20;

export function createSession(key: string): ConversationSession {
  const now = Date.now();
  return {
    key,
    history: [],
    pinnedBeliefs: [],
    createdAt: now,
    lastSeenAt: now,
  };
}

export function appendTurn(
  session: ConversationSession,
  role: 'user' | 'assistant' | 'system',
  content: string,
  metadata?: Record<string, unknown>
): void {
  session.history.push({ role, content, timestamp: Date.now(), ...(metadata ? { metadata } : {}) });
  session.lastSeenAt = Date.now();
}

/**
 * Trim session history to at most `limit * 2` messages. The pre-buffer
 * multiplier (×2) avoids a slice on every single turn — we only act once
 * the buffer overflows, then keep a 2× window so that alternating user /
 * assistant turns aren't split mid-exchange.
 */
export function trimHistory(session: ConversationSession, limit: number): void {
  if (session.history.length > limit * 2) {
    session.history = session.history.slice(-limit * 2);
  }
}

export function getRecentHistory(session: ConversationSession, n: number): SessionMessage[] {
  return session.history.slice(-n);
}
