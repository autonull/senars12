import { join } from 'node:path';
import { errMsg, LruCache, tokenizeWords } from '@senars/util';
import { createLogger } from '@senars/core/logger';
import { readJsonFileSync, writeJsonFileSync } from '../utils/fs.js';

export interface TranslationCacheEntry {
  nl: string;
  result: TranslationResult | string;
  timestamp: number;
}

export interface TranslationResult {
  beliefs: Array<{ narsese: string; truth?: { f: number; c: number } }>;
  questions: string[];
  goals: string[];
  summary: string;
}

export interface SerializedCache {
  entries: TranslationCacheEntry[];
  version: number;
}

const logger = createLogger({ scope: 'nl:cache' });

const DEFAULTS = { maxSize: 500, flushInterval: 100, ttlMs: 60 * 60 * 1000 } as const;

export class TranslationCache {
  readonly #cache: LruCache<string, TranslationCacheEntry>;
  private flushCounter = 0;
  private readonly flushInterval: number;
  private readonly ttlMs: number;
  private flushTimer?: NodeJS.Timeout;

  constructor(opts?: {
    maxSize?: number;
    flushInterval?: number;
    ttlMs?: number;
    basePath?: string;
  }) {
    this.ttlMs = opts?.ttlMs ?? DEFAULTS.ttlMs;
    this.#cache = new LruCache({ maxSize: opts?.maxSize ?? DEFAULTS.maxSize, ttlMs: this.ttlMs });
    this.flushInterval = opts?.flushInterval ?? DEFAULTS.flushInterval;
    if (opts?.basePath) {
      this.loadFromFile(opts.basePath);
      this.startAutoFlush(opts.basePath);
    }
  }

  record(nl: string, result: TranslationResult | string): void {
    this.#cache.set(nl.toLowerCase(), { nl, result, timestamp: Date.now() });
    if (++this.flushCounter >= this.flushInterval) this.flushCounter = 0;
  }

  get(nl: string): TranslationResult | string | null {
    return this.#cache.get(nl.toLowerCase())?.result ?? null;
  }

  getRelevant(nl: string, max = 3): TranslationCacheEntry[] {
    const words = tokenizeWords(nl);
    return this.#cache
      .toArray()
      .filter((entry) => [...tokenizeWords(entry.nl)].some((word) => words.has(word)))
      .slice(0, max);
  }

  serialize(): SerializedCache {
    return { entries: this.#cache.toArray(), version: 1 };
  }

  deserialize(data: SerializedCache): void {
    this.#cache.clear();
    const cutoff = Date.now() - this.ttlMs;
    for (const entry of data.entries) {
      if (entry.timestamp >= cutoff) this.#cache.set(entry.nl.toLowerCase(), entry);
    }
  }

  saveToFile(basePath: string): void {
    try {
      writeJsonFileSync(join(basePath, 'translation-cache.json'), this.serialize());
    } catch (error) {
      logger.warn(`translation cache save failed: ${errMsg(error)}`);
    }
  }

  loadFromFile(basePath: string): void {
    try {
      this.deserialize(
        readJsonFileSync<SerializedCache>(join(basePath, 'translation-cache.json'), {
          entries: [],
          version: 1,
        })
      );
    } catch (error) {
      logger.warn(`translation cache load failed: ${errMsg(error)}`);
    }
  }

  close(): void {
    clearInterval(this.flushTimer);
    this.flushTimer = undefined;
  }

  private startAutoFlush(basePath: string): void {
    this.flushTimer = setInterval(() => this.saveToFile(basePath), 5 * 60 * 1000);
    this.flushTimer.unref();
  }
}
