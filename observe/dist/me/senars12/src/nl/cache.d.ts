import type { TranslationResult as SchemaTranslationResult } from '../lm/rule-templates/schemas';
export interface TranslationCacheEntry {
    nl: string;
    result: TranslationResult | string;
    timestamp: number;
}
/**
 * What a translation cached: the LM rule's own output shape.
 *
 * Was written out here as a second declaration of `TranslationSchema`'s inferred
 * type — identical field for field, and free to drift from it. The cache holds
 * what the translation seam produced, so it holds what that seam produces.
 */
export type TranslationResult = SchemaTranslationResult;
export interface SerializedCache {
    entries: TranslationCacheEntry[];
    version: number;
}
export declare class TranslationCache {
    #private;
    private flushCounter;
    private readonly flushInterval;
    private readonly ttlMs;
    private stopFlushTimer?;
    constructor(opts?: {
        maxSize?: number;
        flushInterval?: number;
        ttlMs?: number;
        basePath?: string;
    });
    record(nl: string, result: TranslationResult | string): void;
    get(nl: string): TranslationResult | string | null;
    getRelevant(nl: string, max?: number): TranslationCacheEntry[];
    serialize(): SerializedCache;
    deserialize(data: SerializedCache): void;
    saveToFile(basePath: string): void;
    loadFromFile(basePath: string): void;
    close(): void;
    private startAutoFlush;
}
//# sourceMappingURL=cache.d.ts.map