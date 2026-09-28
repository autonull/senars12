import { abortSession, createSession, InMemorySessionManager, SessionStore } from '@senars/util/memory';
import type { ConversationSession, SessionManager } from '@senars/util/types/memory';
import { type Ledger, BaseLedgerEntrySchema, createLedger } from '@senars/io/ledger';
import { z } from 'zod';

/**
 * @deprecated Will be removed in next major version.
 * Use `import { InMemorySessionManager, createSession, abortSession } from '@senars/util/memory'` instead.
 */
export { abortSession, createSession, InMemorySessionManager };

export interface JsonlSessionManagerConfig {
  basePath: string;
}

function getSessionRecordSchema() {
  return BaseLedgerEntrySchema.extend({
    key: z.string(),
    history: z.array(
      z.object({
        role: z.enum(['user', 'agent', 'system']),
        content: z.string(),
        timestamp: z.number(),
      })
    ),
    createdAt: z.number(),
    lastSeenAt: z.number(),
    metadata: z.record(z.string(), z.unknown()),
  });
}

export type SessionLedgerEntry = z.infer<ReturnType<typeof getSessionRecordSchema>>;

/** Bounded in-memory sessions with a JSONL ledger snapshot on close. */
export class JsonlSessionManager implements SessionManager {
  readonly #ledger: Ledger<SessionLedgerEntry>;
  readonly #store = new SessionStore();

  constructor(config: JsonlSessionManagerConfig) {
    this.#ledger = createLedger<SessionLedgerEntry>(config.basePath, getSessionRecordSchema(), {
      rollover: { daily: true, maxEntriesPerFile: 10_000, retentionDays: 30 },
    });
  }

  getOrCreate(key: string): ConversationSession {
    return this.#store.getOrCreate(key);
  }

  size(): number {
    return this.#store.size();
  }

  async restore(): Promise<void> {
    for (const entry of await this.#ledger.query({})) {
      this.#store.load(entry.key, {
        id: `sess-${entry.key}`,
        key: entry.key,
        history: entry.history,
        createdAt: entry.createdAt,
        lastSeenAt: entry.lastSeenAt,
        metadata: entry.metadata,
      });
    }
  }

  async snapshot(): Promise<void> {
    for (const session of this.#store.values()) {
      this.#ledger.append({
        at: session.lastSeenAt,
        key: session.key,
        history: session.history,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        metadata: session.metadata,
      });
    }
  }

  async close(): Promise<void> {
    await this.snapshot();
    this.#store.clear();
    this.#ledger.close();
  }
}
