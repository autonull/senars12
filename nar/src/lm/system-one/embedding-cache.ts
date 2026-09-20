import { TransformersEmbeddingGenerator } from '../../memory/embedding.js';
import type { EmbeddingPointer } from './types.js';

const DIMENSION = 384;
const POOL_SIZE = 8192;

const bufferPool = new Array<Float32Array>(POOL_SIZE);
let poolHead = 0;
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
  generator?: { generate(text: string): Promise<number[]> };
}

interface CacheEntry {
  pointer: EmbeddingPointer;
  buffer: Float32Array;
  timestamp: number;
  accessCount: number;
}

export class EmbeddingCache {
  #generator: TransformersEmbeddingGenerator | NonNullable<EmbeddingCacheConfig['generator']>;
  #config: EmbeddingCacheConfig;
  #cache = new Map<string, CacheEntry>();
  #pointerIndex = new Map<EmbeddingPointer, CacheEntry>();
  #lru = new Map<string, CacheEntry>();
  #accessCounter = 0;
  #pointerCounter = 0;

  constructor(config: Partial<EmbeddingCacheConfig> = {}) {
    this.#config = {
      maxSize: config.maxSize ?? 10000,
      ttlMs: config.ttlMs ?? 300_000,
    };
    this.#generator = config.generator ?? new TransformersEmbeddingGenerator();
  }

  async write(text: string): Promise<EmbeddingPointer> {
    const existing = this.#cache.get(text);
    if (existing) {
      this.#touchEntry(text, existing);
      return existing.pointer;
    }

    const embedding = await this.#generator.generate(text);
    const buffer = allocateBuffer();
    buffer.set(embedding);

    const pointer = (++this.#pointerCounter) as EmbeddingPointer;
    const now = Date.now();

    const entry: CacheEntry = {
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
    const pointer = (++this.#pointerCounter) as EmbeddingPointer;
    const now = Date.now();

    const key = `\0raw:${pointer}`;
    const entry: CacheEntry = {
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
      const firstEntry = this.#lru.values().next().value;
      if (!firstEntry) break;

      const keyToEvict = [...this.#lru.entries()].find(([_, e]) => e === firstEntry)?.[0];
      if (!keyToEvict) break;

      this.#evictEntry(keyToEvict);
    }
  }

  #evictEntry(key: string): void {
    const entry = this.#cache.get(key);
    if (entry) {
      releaseBuffer(entry.buffer);
      this.#cache.delete(key);
      this.#pointerIndex.delete(entry.pointer);
    }
    this.#lru.delete(key);
  }

  #expireStale(now: number): void {
    for (const [key, entry] of this.#cache) {
      if (now - entry.timestamp > this.#config.ttlMs) {
        this.#evictEntry(key);
      }
    }
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