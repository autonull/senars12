import { BaseLedgerEntrySchema, createLedger } from '@senars/util/ledger';
import { abortSession, createSession, InMemorySessionManager } from './in-memory-session-manager';
import { SessionStore } from './in-memory-session-manager';
import { z } from 'zod';
import { HistoryEntrySchema } from '../schemas/common';
/**
 * @deprecated Will be removed in next major version.
 * Use `import { InMemorySessionManager, createSession, abortSession } from '@senars/memory'` instead.
 */
export { abortSession, createSession, InMemorySessionManager };
const SessionRecordSchema = BaseLedgerEntrySchema.extend({
    key: z.string(),
    history: z.array(HistoryEntrySchema),
    createdAt: z.number(),
    lastSeenAt: z.number(),
    metadata: z.record(z.string(), z.unknown()),
});
/** Bounded in-memory sessions with a JSONL ledger snapshot on close. */
export class JsonlSessionManager {
    #ledger;
    #store = new SessionStore();
    constructor(config) {
        this.#ledger = createLedger(config.basePath, SessionRecordSchema);
    }
    getOrCreate(key) {
        return this.#store.getOrCreate(key);
    }
    size() {
        return this.#store.size();
    }
    /**
     * The live sessions, least-recently-used first — the real data behind
     * `sessions://list` (CORE.19 C7.3), rather than a hardcoded empty array.
     */
    list() {
        return [...this.#store.values()];
    }
    async restore() {
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
    async snapshot() {
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
    async close() {
        await this.snapshot();
        this.#store.clear();
        this.#ledger.close();
    }
}
