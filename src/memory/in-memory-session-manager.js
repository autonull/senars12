import { trimCapped } from '@senars/util/collections';
import { generateId } from '@senars/util/id';
import { LruCache } from '@senars/util/lru-cache';
export function abortSession(session) {
    session.metadata.aborted = true;
    session.history = [];
}
export function createSession(key) {
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
/**
 * Bounded session map — the single runtime store behind every `SessionManager`,
 * in-memory or persistent. A long-running agent creates a session per
 * conversation, so the store is the AIKR boundary that keeps the working set
 * finite: LRU sessions, trimmed per-session history.
 */
export class SessionStore {
    #sessions;
    #maxHistory;
    constructor(options = {}) {
        this.#maxHistory = options.maxHistoryPerSession ?? DEFAULT_MAX_HISTORY_PER_SESSION;
        this.#sessions = new LruCache({ maxSize: options.maxSessions ?? DEFAULT_MAX_SESSIONS });
    }
    get maxSessions() {
        return this.#sessions.maxSize;
    }
    size() {
        return this.#sessions.size();
    }
    /** Live sessions, least-recently-used first. */
    *values() {
        yield* this.#sessions.values();
    }
    /** Adopt a session (persistence replay), subject to the same bounds. */
    load(key, session) {
        this.#trim(session);
        this.#sessions.set(key, session);
        return session;
    }
    getOrCreate(key) {
        const existing = this.#sessions.get(key);
        if (existing) {
            existing.lastSeenAt = Date.now();
            this.#trim(existing);
            return existing;
        }
        return this.load(key, createSession(key));
    }
    clear() {
        this.#sessions.clear();
    }
    #trim(session) {
        trimCapped(session.history, this.#maxHistory);
    }
}
/** Sessions with no persistence layer. */
export class InMemorySessionManager {
    #store;
    constructor(options = {}) {
        this.#store = new SessionStore(options);
    }
    getOrCreate(key) {
        return this.#store.getOrCreate(key);
    }
    size() {
        return this.#store.size();
    }
}
