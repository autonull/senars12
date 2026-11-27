import { type EmbeddingGenerator } from '../../memory/embedding';
import type { EmbeddingCache as EmbeddingCacheApi, EmbeddingPointer } from './types';
export interface EmbeddingCacheConfig {
    maxSize: number;
    ttlMs: number;
    /** H1/Bench 26: expected embedding width — wrong-dimension vectors are rejected here. */
    dimension?: number;
    generator?: EmbeddingGenerator;
    /** §5s: per-event metrics sink (wired to Prometheus by SystemOneRuntime). */
    metricsSink?: (event: 'hit' | 'miss' | 'eviction', size: number) => void;
}
/** P2 (TODO20): observability for cache effectiveness. */
export interface EmbeddingCacheMetrics {
    hits: number;
    misses: number;
    writes: number;
    evictions: number;
    size: number;
}
export declare class EmbeddingCache {
    #private;
    constructor(config?: Partial<EmbeddingCacheConfig>);
    write(text: string): Promise<EmbeddingPointer>;
    writeRaw(embedding: readonly number[]): Promise<EmbeddingPointer>;
    read(pointer: EmbeddingPointer): Float32Array | undefined;
    has(text: string): boolean;
    size(): number;
    clear(): void;
    warmup(texts: string[]): Promise<void>;
    /** P2 (TODO20): cache effectiveness metrics. */
    metrics(): EmbeddingCacheMetrics;
    /** Fraction of write() calls served from cache (0 when nothing was written yet). */
    hitRate(): number;
    get generator(): EmbeddingGenerator;
    getConfig(): Readonly<EmbeddingCacheConfig>;
}
export declare function createEmbeddingCache(config?: Partial<EmbeddingCacheConfig>): EmbeddingCache;
/**
 * Embed `text` through any `EmbeddingCache` and return an owned copy of the
 * vector, or `undefined` on any failure (fail-open, no throw). The single
 * write→read embedding path used by graders, gates, and dialogue capture.
 */
export declare const embedCached: (cache: EmbeddingCacheApi, text: string) => Promise<Float32Array | undefined>;
//# sourceMappingURL=embedding-cache.d.ts.map