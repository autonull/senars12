import { join } from 'node:path';
import {
  collectUpTo,
  createLogger,
  errMsg,
  LruCache,
  overlapCount,
  periodic,
  readJsonFileSync,
  tokenizeWords,
  writeJsonFileSync,
} from '@senars/util';
import type { TranslationResult as SchemaTranslationResult } from '../lm/rule-templates/schemas.js';

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

const logger = createLogger({ scope: 'nl:cache' });

const DEFAULTS = { maxSize: 500, flushInterval: 100, ttlMs: 60 * 60 * 1000 } as const;

export class TranslationCache {
  readonly #cache: LruCache<string, TranslationCacheEntry>;
  private flushCounter = 0;
  private readonly flushInterval: number;
  private readonly ttlMs: number;
  private stopFlushTimer?: () => void;

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
    return collectUpTo(this.#cache.values(), max, (entry) =>
      overlapCount(words, tokenizeWords(entry.nl)) > 0 ? entry : undefined
    );
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
    this.stopFlushTimer?.();
    this.stopFlushTimer = undefined;
  }

  private startAutoFlush(basePath: string): void {
    this.stopFlushTimer = periodic(() => this.saveToFile(basePath), 5 * 60 * 1000);
  }
}
