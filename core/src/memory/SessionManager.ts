import { Ledger, createLedger, BaseLedgerEntrySchema, type LedgerQuery } from '@senars/io';
import { z } from 'zod';
import { join } from 'node:path';
import { abortSession, createSession, InMemorySessionManager } from '@senars/util/memory';
import type { ConversationSession, SessionManager } from '@senars/util/types/memory';

/**
 * @deprecated Will be removed in next major version.
 * Use `import { InMemorySessionManager, createSession, abortSession } from '@senars/util/memory'` instead.
 */
export { abortSession, createSession, InMemorySessionManager };

export interface JsonlSessionManagerConfig {
  basePath: string;
}

const SessionRecordSchema = BaseLedgerEntrySchema.extend({
  key: z.string(),
  history: z.array(z.object({
    role: z.enum(['user', 'agent', 'system']),
    content: z.string(),
    timestamp: z.number(),
  })),
  createdAt: z.number(),
  lastSeenAt: z.number(),
  metadata: z.record(z.string(), z.unknown()),
});

export type SessionLedgerEntry = z.infer<typeof SessionRecordSchema>;

export class JsonlSessionManager implements SessionManager {
  readonly #ledger: Ledger<SessionLedgerEntry>;
  #sessions = new Map<string, ConversationSession>();

  constructor(config: JsonlSessionManagerConfig) {
    this.#ledger = createLedger<SessionLedgerEntry>(config.basePath, SessionRecordSchema, {
      rollover: { daily: true, maxEntriesPerFile: 10_000, retentionDays: 30 },
    });
  }

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

  async restore(): Promise<void> {
    const entries = await this.#ledger.query({});
    for (const entry of entries) {
      const key = entry.key;
      const session: ConversationSession = {
        id: `sess-${key}`,
        key,
        history: entry.history,
        createdAt: entry.createdAt,
        lastSeenAt: entry.lastSeenAt,
        metadata: entry.metadata,
      };
      this.#sessions.set(key, session);
    }
  }

  async snapshot(): Promise<void> {
    for (const [key, session] of this.#sessions) {
      this.#ledger.append({
        at: session.lastSeenAt,
        key,
        history: session.history,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        metadata: session.metadata,
      });
    }
  }

  async close(): Promise<void> {
    await this.snapshot();
    this.#sessions.clear();
    this.#ledger.close();
  }
}
