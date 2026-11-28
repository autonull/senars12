/**
 * ThreadScope (REFACTOR.todo4 Phase A).
 * Per-correlationId slice for ContrastiveMemory and sourceKey filter.
 * Fixes the context-bleed bug where one user's `.react correct` shifts
 * every other user's manifold judgments.
 *
 * Bounded by LRU capacity: correlation ids arrive per inbound message from
 * untrusted transports, so an unbounded map here is a slow memory leak. The
 * least-recently-touched thread is evicted whole — a half-evicted scope would
 * reintroduce exactly the context bleed this class exists to prevent.
 */
export interface ThreadScopeState {
    contrastiveMemory?: object;
    sourceKey?: string;
}
export declare class ThreadScope {
    #private;
    /**
     * Get or create a scope for the given correlationId.
     * Returns the same object for the same correlationId, ensuring isolation.
     */
    get(correlationId: string): ThreadScopeState;
    /**
     * Delete a scope (e.g., on session end).
     */
    delete(correlationId: string): boolean;
    /** Check if a scope exists. */
    has(correlationId: string): boolean;
    /** Get all active correlationIds. */
    correlationIds(): string[];
    /** Clear all scopes. */
    clear(): void;
}
/** Singleton instance for the process. */
export declare const threadScope: ThreadScope;
//# sourceMappingURL=thread-scope.d.ts.map