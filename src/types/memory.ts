import { z } from 'zod';
import { HistoryEntrySchema, type HistoryEntry } from '@senars/generated';

/**
 * Who spoke a turn. The chat wire schema, the session ledger's persistence
 * schema and `ConversationSession.history` each declared this union on their
 * own, so a fourth speaker had to be added in three places and nothing failed
 * when one of them was missed — the ledger would write a row the wire refused to
 * read back. The table lives beside the type it validates, as
 * `capability.ts` does for the risk tiers.
 */
export const MESSAGE_ROLES = ['user', 'agent', 'system'] as const;

export const MessageRoleSchema = z.enum(MESSAGE_ROLES);

export type MessageRole = (typeof MESSAGE_ROLES)[number];

export { HistoryEntrySchema, type HistoryEntry };

export interface ConversationSession {
  id: string;
  key: string;
  history: HistoryEntry[];
  createdAt: number;
  lastSeenAt: number;
  metadata: Record<string, unknown>;
}

export interface SessionManager {
  getOrCreate(key: string): ConversationSession;

  size(): number;
}
