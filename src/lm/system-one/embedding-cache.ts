import { getOrInsert, LruCache } from '@senars/util';
import { type EmbeddingGenerator } from '../../memory/embedding.js';
import { resolveEmbeddingGenerator } from '../embedding-runtime.js';
import type { EmbeddingCache as EmbeddingCacheApi, EmbeddingPointer } from './types.js';

/** One width's recycled buffers. A slot is reusable only at its own width, so a
 *  model swap does not silently reinterpret another model's vectors. */
interface BufferPool {
  buffers: Float32Array[];
  free: number[];
}

/** Process-wide pools keyed by width: a pool grows to the high-water mark of
 *  *concurrent* live embeddings at that width (bounded by the cache's `maxSize`),
 *  and released slots recycle through the free list. Slots travel with their
 *  entry so release is O(1). */
const bufferPools = new Map<number, BufferPool>();

function allocateBuffer(dimension: number): {
  pool: BufferPool;
  slot: number;
  buffer: Float32Array;
} {
  const pool = getOrInsert(bufferPools, dimension, () => ({ buffers: [], free: [] }));
  const recycled = pool.free.pop();
  if (recycled !== undefined) return { pool, slot: recycled, buffer: pool.buffers[recycled]! };
  const buffer = new Float32Array(dimension);
  pool.buffers.push(buffer);
  return { pool, slot: pool.buffers.length - 1, buffer };
}

export interface EmbeddingCacheConfig {
  maxSize: number;
  ttlMs: number;
  /** H1/Bench 26: expected embedding width — wrong-dimension vectors are rejected here. */
  dimension?: number;
  generator?: EmbeddingGenerator;
  /** §5s: per-event metrics sink (wired to Prometheus by SystemOneRuntime). */
  metricsSink?: (event: 'hit' | 'miss' | 'eviction', size: number) => void;
}

interface CacheEntry {
  /** The LRU key this entry is filed under — the handle a pointer read touches. */
  key: string;
  pointer: EmbeddingPointer;
  pool: BufferPool;
  slot: number;
  buffer: Float32Array;
}

/** P2 (TODO20): observability for cache effectiveness. */
export interface EmbeddingCacheMetrics {
  hits: number;
  misses: number;
  writes: number;
  evictions: number;
  size: number;
}

export class EmbeddingCache {
  #generator: EmbeddingGenerator;
  #config: EmbeddingCacheConfig;
  #cache: LruCache<string, CacheEntry>;
  #pointerIndex = new Map<EmbeddingPointer, CacheEntry>();
  #pointerCounter = 0;
  /**
   * The two counts only this wrapper sees. Hits and misses are `LruCache`'s to
   * keep — a second tally here could disagree with the cache about the same
   * reads — so `metrics()` reads those from it and owns only what it alone does:
   * a write, and the release of a pooled buffer.
   */
  #writes = 0;
  #evictions = 0;
  readonly #metricsSink?: NonNullable<EmbeddingCacheConfig['metricsSink']>;

  constructor(config: Partial<EmbeddingCacheConfig> = {}) {
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
  #forgetEntry(entry: CacheEntry): void {
    entry.pool.free.push(entry.slot);
    this.#pointerIndex.delete(entry.pointer);
    this.#evictions++;
    this.#emit('eviction');
  }

  #emit(event: 'hit' | 'miss' | 'eviction'): void {
    this.#metricsSink?.(event, this.#cache.size());
  }

  async write(text: string): Promise<EmbeddingPointer> {
    const existing = this.#cache.get(text);
    if (existing) {
      this.#emit('hit');
      return existing.pointer;
    }
    this.#emit('miss');

    const embedding = await this.#generator.generate(text);
    if (this.#config.dimension !== undefined && embedding.length !== this.#config.dimension) {
      throw new Error(
        `Embedding dimension mismatch: expected ${this.#config.dimension}, got ${embedding.length}`
      );
    }
    const { pool, slot, buffer } = allocateBuffer(embedding.length);
    buffer.set(embedding);

    const pointer = ++this.#pointerCounter as EmbeddingPointer;
    this.#writes++;
    this.#insert(text, { key: text, pointer, pool, slot, buffer });

    return pointer;
  }

  async writeRaw(embedding: readonly number[]): Promise<EmbeddingPointer> {
    const { pool, slot, buffer } = allocateBuffer(embedding.length);
    buffer.set(embedding);
    const pointer = ++this.#pointerCounter as EmbeddingPointer;

    this.#writes++;
    const key = `\0raw:${pointer}`;
    this.#insert(key, { key, pointer, pool, slot, buffer });

    return pointer;
  }

  read(pointer: EmbeddingPointer): Float32Array | undefined {
    const entry = this.#pointerIndex.get(pointer);
    if (!entry) return undefined;
    // `touch`, not `get`: a pointer read is a recency bump, not a lookup, and
    // touching is what evicts an expired entry — whose buffer is already back
    // on the free list, so handing it to this reader would alias a later write.
    return this.#cache.touch(entry.key) ? entry.buffer : undefined;
  }

  has(text: string): boolean {
    return this.#cache.has(text);
  }

  size(): number {
    return this.#cache.size();
  }

  clear(): void {
    this.#cache.clear();
    this.#pointerIndex.clear();
    this.#writes = 0;
    this.#evictions = 0;
  }

  async warmup(texts: string[]): Promise<void> {
    await Promise.all(texts.map((t) => this.write(t)));
  }

  #insert(key: string, entry: CacheEntry): void {
    this.#cache.set(key, entry);
    this.#pointerIndex.set(entry.pointer, entry);
  }

  /** P2 (TODO20): cache effectiveness metrics. */
  metrics(): EmbeddingCacheMetrics {
    return {
      hits: this.#cache.hits,
      misses: this.#cache.misses,
      writes: this.#writes,
      evictions: this.#evictions,
      size: this.#cache.size(),
    };
  }

  /** Fraction of write() calls served from cache (0 when nothing was written yet). */
  hitRate(): number {
    return this.#cache.hitRate;
  }

  get generator(): EmbeddingGenerator {
    return this.#generator;
  }

  getConfig(): Readonly<EmbeddingCacheConfig> {
    return { ...this.#config };
  }
}

export function createEmbeddingCache(config?: Partial<EmbeddingCacheConfig>): EmbeddingCache {
  return new EmbeddingCache(config);
}

/**
 * Embed `text` through any `EmbeddingCache` and return an owned copy of the
 * vector, or `undefined` on any failure (fail-open, no throw). The single
 * write→read embedding path used by graders, gates, and dialogue capture.
 */
export const embedCached = async (
  cache: EmbeddingCacheApi,
  text: string
): Promise<Float32Array | undefined> => {
  try {
    return cache.read(await cache.write(text))?.slice();
  } catch {
    return undefined;
  }
};
