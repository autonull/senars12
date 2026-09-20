import { TransformersEmbeddingGenerator } from '../../memory/embedding.js';
import type { EmbeddingPointer } from './types.js';

const DIMENSION = 384;
const POOL_SIZE = 8192;

const bufferPool = new Array<Float32Array>(POOL_SIZE);
let poolHead = 0;

function allocateBuffer(): Float32Array {
  if (poolHead < POOL_SIZE) {
    const buf = new Float32Array(DIMENSION);
    bufferPool[poolHead++] = buf;
    return buf;
  }
  const idx = Math.floor(Math.random() * POOL_SIZE);
  return bufferPool[idx]!;
}

export interface EmbeddingCacheConfig {
  maxSize: number;
  ttlMs: number;
}

interface CacheEntry {
  pointer: EmbeddingPointer;
  buffer: Float32Array;
  timestamp: number;
  accessCount: number;
}

export class EmbeddingCache {
  #generator: TransformersEmbeddingGenerator;
  #config: EmbeddingCacheConfig;
  #cache = new Map<string, CacheEntry>();
  #lru = new Map<string, number>();
  #accessCounter = 0;
  #pointerCounter = 0;

  constructor(config: Partial<EmbeddingCacheConfig> = {}) {
    this.#config = {
      maxSize: config.maxSize ?? 10000,
      ttlMs: config.ttlMs ?? 300_000,
    };
    this.#generator = new TransformersEmbeddingGenerator(this.#config.maxSize);
  }

  async write(text: string): Promise<EmbeddingPointer> {
    const existing = this.#cache.get(text);
    if (existing) {
      this.#lru.set(text, ++this.#accessCounter);
      existing.accessCount++;
      existing.timestamp = Date.now();
      return existing.pointer;
    }

    const embedding = await this.#generator.generate(text);
    const buffer = allocateBuffer();
    buffer.set(embedding);

    const pointer = (++this.#pointerCounter) as EmbeddingPointer;
    const now = Date.now();

    this.#cache.set(text, {
      pointer,
      buffer,
      timestamp: now,
      accessCount: 1,
    });
    this.#lru.set(text, ++this.#accessCounter);

    this.#evictIfNeeded();
    this.#expireStale(now);

    return pointer;
  }

  read(pointer: EmbeddingPointer): Float32Array | undefined {
    for (const [text, entry] of this.#cache) {
      if (entry.pointer === pointer) {
        this.#lru.set(text, ++this.#accessCounter);
        entry.accessCount++;
        return entry.buffer;
      }
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
    this.#cache.clear();
    this.#lru.clear();
  }

  async warmup(texts: string[]): Promise<void> {
    await Promise.all(texts.map((t) => this.write(t)));
  }

  #evictIfNeeded(): void {
    while (this.#cache.size > this.#config.maxSize) {
      let oldestKey: string | null = null;
      let oldestAccess = Infinity;

      for (const [key, access] of this.#lru) {
        if (access < oldestAccess) {
          oldestAccess = access;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.#cache.delete(oldestKey);
        this.#lru.delete(oldestKey);
      } else {
        break;
      }
    }
  }

  #expireStale(now: number): void {
    for (const [text, entry] of this.#cache) {
      if (now - entry.timestamp > this.#config.ttlMs) {
        this.#cache.delete(text);
        this.#lru.delete(text);
      }
    }
  }

  get generator(): TransformersEmbeddingGenerator {
    return this.#generator;
  }

  getConfig(): Readonly<EmbeddingCacheConfig> {
    return { ...this.#config };
  }
}

export function createEmbeddingCache(config?: Partial<EmbeddingCacheConfig>): EmbeddingCache {
  return new EmbeddingCache(config);
}