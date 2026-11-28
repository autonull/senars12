/**
 * Per-correlationId scope store (Phase A) — the contract that keeps one user's
 * context from bleeding into another's. `nar` holds the LRU-backed
 * implementation; `core` only needs to name the reader.
 * Extracted to break pipeline.ts <-> types.ts cycle.
 */
export interface CorrelationScopeStore {
    get(correlationId: string): {
        contrastiveMemory?: object;
        sourceKey?: string;
    };
}
//# sourceMappingURL=correlation-scope.d.ts.map