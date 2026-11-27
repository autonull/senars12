import { getOrInsert } from '@senars/util/collections';
import { LruCache } from '@senars/util/lru-cache';
import { resolveEmbeddingGenerator } from '../embedding-runtime';
import { SenarsError } from '../../errors/senars-error';
/** Process-wide pools keyed by width: a pool grows to the high-water mark of
 *  *concurrent* live embeddings at that width (bounded by the cache's `maxSize`),
 *  and released slots recycle through the free list. Slots travel with their
 *  entry so release is O(1). */
const bufferPools = new Map();
function allocateBuffer(dimension) {
    const pool = getOrInsert(bufferPools, dimension, () => ({ buffers: [], free: [] }));
    const recycled = pool.free.pop();
    if (recycled !== undefined)
        return { pool, slot: recycled, buffer: pool.buffers[recycled] };
    const buffer = new Float32Array(dimension);
    pool.buffers.push(buffer);
    return { pool, slot: pool.buffers.length - 1, buffer };
}
export class EmbeddingCache {
    #generator;
    #config;
    #cache;
    #pointerIndex = new Map();
    #pointerCounter = 0;
    /**
     * The two counts only this wrapper sees. Hits and misses are `LruCache`'s to
     * keep — a second tally here could disagree with the cache about the same
     * reads — so `metrics()` reads those from it and owns only what it alone does:
     * a write, and the release of a pooled buffer.
     */
    #writes = 0;
    #evictions = 0;
    #metricsSink;
    constructor(config = {}) {
        this.#config = {
            maxSize: config.maxSize ?? 10000,
            ttlMs: config.ttlMs ?? 300_000,
            dimension: config.dimension,
        };
        this.#generator = config.generator ?? resolveEmbeddingGenerator();
        this.#metricsSink = config.metricsSink;
        this.#cache = new LruCache({
            maxSize: this.#config.maxSize,
            ttlMs: this.#config.ttlMs,
            onEvict: (entry) => this.#forgetEntry(entry),
        });
    }
    /** Release everything the cache holds outside itself: pooled buffer + pointer index. */
    #forgetEntry(entry) {
        entry.pool.free.push(entry.slot);
        this.#pointerIndex.delete(entry.pointer);
        this.#evictions++;
        this.#emit('eviction');
    }
    #emit(event) {
        this.#metricsSink?.(event, this.#cache.size());
    }
    async write(text) {
        const existing = this.#cache.get(text);
        if (existing) {
            this.#emit('hit');
            return existing.pointer;
        }
        this.#emit('miss');
        const embedding = await this.#generator.generate(text);
        if (this.#config.dimension !== undefined && embedding.length !== this.#config.dimension) {
            throw new SenarsError(`Embedding dimension mismatch: expected ${this.#config.dimension}, got ${embedding.length}`, 'CONFIGURATION_ERROR');
        }
        const { pool, slot, buffer } = allocateBuffer(embedding.length);
        buffer.set(embedding);
        const pointer = ++this.#pointerCounter;
        this.#writes++;
        this.#insert(text, { key: text, pointer, pool, slot, buffer });
        return pointer;
    }
    async writeRaw(embedding) {
        const { pool, slot, buffer } = allocateBuffer(embedding.length);
        buffer.set(embedding);
        const pointer = ++this.#pointerCounter;
        this.#writes++;
        const key = `\0raw:${pointer}`;
        this.#insert(key, { key, pointer, pool, slot, buffer });
        return pointer;
    }
    read(pointer) {
        const entry = this.#pointerIndex.get(pointer);
        if (!entry)
            return undefined;
        // `touch`, not `get`: a pointer read is a recency bump, not a lookup, and
        // touching is what evicts an expired entry — whose buffer is already back
        // on the free list, so handing it to this reader would alias a later write.
        return this.#cache.touch(entry.key) ? entry.buffer : undefined;
    }
    has(text) {
        return this.#cache.has(text);
    }
    size() {
        return this.#cache.size();
    }
    clear() {
        this.#cache.clear();
        this.#pointerIndex.clear();
        this.#writes = 0;
        this.#evictions = 0;
    }
    async warmup(texts) {
        await Promise.all(texts.map((t) => this.write(t)));
    }
    #insert(key, entry) {
        this.#cache.set(key, entry);
        this.#pointerIndex.set(entry.pointer, entry);
    }
    /** P2 (TODO20): cache effectiveness metrics. */
    metrics() {
        return {
            hits: this.#cache.hits,
            misses: this.#cache.misses,
            writes: this.#writes,
            evictions: this.#evictions,
            size: this.#cache.size(),
        };
    }
    /** Fraction of write() calls served from cache (0 when nothing was written yet). */
    hitRate() {
        return this.#cache.hitRate;
    }
    get generator() {
        return this.#generator;
    }
    getConfig() {
        return { ...this.#config };
    }
}
export function createEmbeddingCache(config) {
    return new EmbeddingCache(config);
}
/**
 * Embed `text` through any `EmbeddingCache` and return an owned copy of the
 * vector, or `undefined` on any failure (fail-open, no throw). The single
 * write→read embedding path used by graders, gates, and dialogue capture.
 */
export const embedCached = async (cache, text) => {
    try {
        return cache.read(await cache.write(text))?.slice();
    }
    catch {
        return undefined;
    }
};
