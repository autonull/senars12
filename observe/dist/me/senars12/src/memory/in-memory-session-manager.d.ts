import type { ConversationSession, SessionManager } from '@senars/types/memory';
export declare function abortSession(session: ConversationSession): void;
export declare function createSession(key: string): ConversationSession;
/** D15 (TODO17b): bounded runtime — sessions and per-session history are capped. */
export declare const DEFAULT_MAX_SESSIONS = 200;
export declare const DEFAULT_MAX_HISTORY_PER_SESSION = 100;
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
export declare class SessionStore {
    #private;
    constructor(options?: SessionStoreOptions);
    get maxSessions(): number;
    size(): number;
    /** Live sessions, least-recently-used first. */
    values(): Generator<ConversationSession>;
    /** Adopt a session (persistence replay), subject to the same bounds. */
    load(key: string, session: ConversationSession): ConversationSession;
    getOrCreate(key: string): ConversationSession;
    clear(): void;
}
/** Sessions with no persistence layer. */
export declare class InMemorySessionManager implements SessionManager {
    #private;
    constructor(options?: SessionStoreOptions);
    getOrCreate(key: string): ConversationSession;
    size(): number;
}
//# sourceMappingURL=in-memory-session-manager.d.ts.map