import { TransformersEmbeddingGenerator } from '../../memory/embedding.js';
import type { EmbeddingPointer } from './types.js';

const DIMENSION = 384;
const POOL_SIZE = 8192;

const bufferPool = new Array<Float32Array>(POOL_SIZE);
const poolHead = 0;
const freeList: number[] = [];

function allocateBuffer(): Float32Array {
  if (freeList.length > 0) {
    const idx = freeList.pop()!;
    return bufferPool[idx]!;
  }
  if (poolHead < POOL_SIZE) {
    const buf = new Float32Array(DIMENSION);
    bufferPool[poolHead] = buf;
    return buf;
  }
  throw new Error('Embedding buffer pool exhausted and free-list empty');
}

function releaseBuffer(buffer: Float32Array): void {
  const idx = bufferPool.indexOf(buffer);
  if (idx >= 0) {
    freeList.push(idx);
  }
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
  #cache = new Map<string, CacheEntry>();
  #pointerIndex = new Map<EmbeddingPointer, CacheEntry>();
  #lru = new Map<string, CacheEntry>();
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
      this.#touchEntry(text, existing);
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
    const buffer = allocateBuffer();
    buffer.set(embedding);

    const pointer = ++this.#pointerCounter as EmbeddingPointer;
    const now = Date.now();
    this.#metrics.writes++;

    const entry: CacheEntry = {
      key: text,
      pointer,
      buffer,
      timestamp: now,
      accessCount: 1,
    };

    this.#cache.set(text, entry);
    this.#pointerIndex.set(pointer, entry);
    this.#lru.set(text, entry);

    this.#evictIfNeeded();
    this.#expireStale(now);

    return pointer;
  }

  async writeRaw(embedding: readonly number[]): Promise<EmbeddingPointer> {
    const buffer = allocateBuffer();
    buffer.set(embedding.slice(0, buffer.length));
    const pointer = ++this.#pointerCounter as EmbeddingPointer;
    const now = Date.now();

    const key = `\0raw:${pointer}`;
    this.#metrics.writes++;
    const entry: CacheEntry = {
      key,
      pointer,
      buffer,
      timestamp: now,
      accessCount: 1,
    };

    this.#cache.set(key, entry);
    this.#pointerIndex.set(pointer, entry);
    this.#lru.set(key, entry);

    this.#evictIfNeeded();
    this.#expireStale(now);

    return pointer;
  }

  read(pointer: EmbeddingPointer): Float32Array | undefined {
    const entry = this.#pointerIndex.get(pointer);
    if (entry) {
      entry.accessCount++;
      return entry.buffer;
    }
    return undefined;
  }

  has(text: string): boolean {
    return this.#cache.has(text);
  }

  size(): number {
    return this.#cache.size;
  }

  clear(): void {
    for (const entry of this.#cache.values()) {
      releaseBuffer(entry.buffer);
    }
    this.#cache.clear();
    this.#pointerIndex.clear();
    this.#lru.clear();
    this.#metrics = { hits: 0, misses: 0, writes: 0, evictions: 0 };
    this.#nextExpirySweep = 0;
  }

  async warmup(texts: string[]): Promise<void> {
    await Promise.all(texts.map((t) => this.write(t)));
  }

  #touchEntry(key: string, entry: CacheEntry): void {
    entry.accessCount++;
    entry.timestamp = Date.now();
    this.#lru.delete(key);
    this.#lru.set(key, entry);
  }

  #evictIfNeeded(): void {
    while (this.#cache.size > this.#config.maxSize) {
      // LRU head: insertion-ordered Map; the entry stores its own key (O(1) eviction).
      const firstEntry = this.#lru.values().next().value;
      if (!firstEntry) break;
      this.#evictEntry(firstEntry.key);
    }
  }

  #evictEntry(key: string): void {
    const entry = this.#cache.get(key);
    if (entry) {
      releaseBuffer(entry.buffer);
      this.#cache.delete(key);
      this.#pointerIndex.delete(entry.pointer);
      this.#metrics.evictions++;
      this.#emit('eviction');
    }
    this.#lru.delete(key);
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
