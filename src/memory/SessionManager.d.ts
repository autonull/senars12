import { abortSession, createSession, InMemorySessionManager } from './in-memory-session-manager';
import type { ConversationSession, SessionManager } from '@senars/util/types/memory';
import { z } from 'zod';
/**
 * @deprecated Will be removed in next major version.
 * Use `import { InMemorySessionManager, createSession, abortSession } from '@senars/memory'` instead.
 */
export { abortSession, createSession, InMemorySessionManager };
export interface JsonlSessionManagerConfig {
    basePath: string;
}
declare const SessionRecordSchema: any;
export type SessionLedgerEntry = z.infer<typeof SessionRecordSchema>;
/** Bounded in-memory sessions with a JSONL ledger snapshot on close. */
export declare class JsonlSessionManager implements SessionManager {
    #private;
    constructor(config: JsonlSessionManagerConfig);
    getOrCreate(key: string): ConversationSession;
    size(): number;
    /**
     * The live sessions, least-recently-used first — the real data behind
     * `sessions://list` (CORE.19 C7.3), rather than a hardcoded empty array.
     */
    list(): ConversationSession[];
    restore(): Promise<void>;
    snapshot(): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=SessionManager.d.ts.map