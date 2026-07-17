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
