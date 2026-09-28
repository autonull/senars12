import { TransformersEmbeddingGenerator } from '../../memory/embedding.js';
import type { EmbeddingPointer } from './types.js';

const DIMENSION = 384;

/** Process-wide buffer pool: the pool grows to the high-water mark of *concurrent*
 *  live embeddings (bounded by the cache's own `maxSize`), and released slots are
 *  recycled through the free list. Slots travel with their entry so release is O(1). */
const bufferPool: Float32Array[] = [];
const freeList: number[] = [];

function allocateBuffer(): { slot: number; buffer: Float32Array } {
  const recycled = freeList.pop();
  if (recycled !== undefined) return { slot: recycled, buffer: bufferPool[recycled]! };
  const buffer = new Float32Array(DIMENSION);
  bufferPool.push(buffer);
  return { slot: bufferPool.length - 1, buffer };
}

function releaseBuffer(slot: number): void {
  freeList.push(slot);
}

export interface EmbeddingCacheConfig {
  maxSize: number;
  ttlMs: number;
  /** H1/Bench 26: expected embedding width — wrong-dimension vectors are rejected here. */
  dimension?: number;
  generator?: { generate(text: string): Promise<number[]> };
  /** §5s: per-event metrics sink (wired to Prometheus by SystemOneRuntime). */
  metricsSink?: (event: 'hit' | 'miss' | 'eviction', size: number) => void;
}

interface CacheEntry {
  key: string;
  pointer: EmbeddingPointer;
  slot: number;
  buffer: Float32Array;
  timestamp: number;
  accessCount: number;
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
  #generator: TransformersEmbeddingGenerator | NonNullable<EmbeddingCacheConfig['generator']>;
  #config: EmbeddingCacheConfig;
  /** Map insertion order is the LRU order: `#touch` re-inserts, eviction takes the first key. */
  #cache = new Map<string, CacheEntry>();
  #pointerIndex = new Map<EmbeddingPointer, CacheEntry>();
  #pointerCounter = 0;
  #metrics = { hits: 0, misses: 0, writes: 0, evictions: 0 };
  #nextExpirySweep = 0;
  readonly #metricsSink?: NonNullable<EmbeddingCacheConfig['metricsSink']>;

  constructor(config: Partial<EmbeddingCacheConfig> = {}) {
    this.#config = {
      maxSize: config.maxSize ?? 10000,
      ttlMs: config.ttlMs ?? 300_000,
      dimension: config.dimension,
    };
    this.#generator = config.generator ?? new TransformersEmbeddingGenerator();
    this.#metricsSink = config.metricsSink;
  }

  #emit(event: 'hit' | 'miss' | 'eviction'): void {
    this.#metricsSink?.(event, this.#cache.size);
  }

  async write(text: string): Promise<EmbeddingPointer> {
    const existing = this.#cache.get(text);
    if (existing) {
      this.#metrics.hits++;
      this.#emit('hit');
      this.#touchEntry(existing);
      return existing.pointer;
    }
    this.#metrics.misses++;
    this.#emit('miss');

    const embedding = await this.#generator.generate(text);
    if (this.#config.dimension !== undefined && embedding.length !== this.#config.dimension) {
      throw new Error(
        `Embedding dimension mismatch: expected ${this.#config.dimension}, got ${embedding.length}`
      );
    }
    const { slot, buffer } = allocateBuffer();
    buffer.set(embedding);

    const pointer = ++this.#pointerCounter as EmbeddingPointer;
    const now = Date.now();
    this.#metrics.writes++;

    this.#insert(text, { key: text, pointer, slot, buffer, timestamp: now, accessCount: 1 });

    return pointer;
  }

  async writeRaw(embedding: readonly number[]): Promise<EmbeddingPointer> {
    const { slot, buffer } = allocateBuffer();
    buffer.set(embedding.slice(0, buffer.length));
    const pointer = ++this.#pointerCounter as EmbeddingPointer;
    const now = Date.now();

    this.#metrics.writes++;
    const key = `\0raw:${pointer}`;
    this.#insert(key, { key, pointer, slot, buffer, timestamp: now, accessCount: 1 });

    return pointer;
  }

  read(pointer: EmbeddingPointer): Float32Array | undefined {
    const entry = this.#pointerIndex.get(pointer);
    if (!entry) return undefined;
    this.#touchEntry(entry);
    return entry.buffer;
  }

  has(text: string): boolean {
    return this.#cache.has(text);
  }

  size(): number {
    return this.#cache.size;
  }

  clear(): void {
    for (const entry of this.#cache.values()) releaseBuffer(entry.slot);
    this.#cache.clear();
    this.#pointerIndex.clear();
    this.#metrics = { hits: 0, misses: 0, writes: 0, evictions: 0 };
    this.#nextExpirySweep = 0;
  }

  async warmup(texts: string[]): Promise<void> {
    await Promise.all(texts.map((t) => this.write(t)));
  }

  #insert(key: string, entry: CacheEntry): void {
    this.#cache.set(key, entry);
    this.#pointerIndex.set(entry.pointer, entry);
    this.#evictIfNeeded();
    this.#expireStale(entry.timestamp);
  }

  #touchEntry(entry: CacheEntry): void {
    entry.accessCount++;
    entry.timestamp = Date.now();
    const { key } = entry;
    this.#cache.delete(key);
    this.#cache.set(key, entry);
  }

  #evictIfNeeded(): void {
    while (this.#cache.size > this.#config.maxSize) {
      const lru = this.#cache.keys().next().value;
      if (lru === undefined) break;
      this.#evictEntry(lru);
    }
  }

  #evictEntry(key: string): void {
    const entry = this.#cache.get(key);
    if (entry) {
      releaseBuffer(entry.slot);
      this.#pointerIndex.delete(entry.pointer);
      this.#metrics.evictions++;
      this.#emit('eviction');
    }
    this.#cache.delete(key);
  }

  #expireStale(now: number): void {
    // Amortized: a full scan per write is O(n) on the hot path; sweep at most
    // once per ttlMs/4 window (stale entries are still evicted lazily by LRU).
    if (now < this.#nextExpirySweep) return;
    this.#nextExpirySweep = now + this.#config.ttlMs / 4;
    for (const [key, entry] of this.#cache) {
      if (now - entry.timestamp > this.#config.ttlMs) {
        this.#evictEntry(key);
      }
    }
  }

  /** P2 (TODO20): cache effectiveness metrics. */
  metrics(): EmbeddingCacheMetrics {
    return { ...this.#metrics, size: this.#cache.size };
  }

  /** Fraction of write() calls served from cache (0 when nothing was written yet). */
  hitRate(): number {
    const total = this.#metrics.hits + this.#metrics.misses;
    return total === 0 ? 0 : this.#metrics.hits / total;
  }

  get generator(): TransformersEmbeddingGenerator | NonNullable<EmbeddingCacheConfig['generator']> {
    return this.#generator;
  }

  getConfig(): Readonly<EmbeddingCacheConfig> {
    return { ...this.#config };
  }
}

export function createEmbeddingCache(config?: Partial<EmbeddingCacheConfig>): EmbeddingCache {
  return new EmbeddingCache(config);
}
