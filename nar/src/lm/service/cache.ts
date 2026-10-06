import { type Clock, djb2, LruCache } from '@senars/util';
import type { LMGenerateOptions } from '@senars/util';

const CACHE_TTL_MS = 60_000;

/** The key covers every field that can change a completion, in a fixed order. */
export function buildCacheKey(prompt: string, options?: LMGenerateOptions): string {
  const parts = [
    prompt,
    options?.task ?? 'fast',
    options?.temperature ?? 0,
    options?.maxOutputTokens ?? 0,
    options?.grammar ?? '',
    options?.model ?? '',
  ];
  return djb2(parts.join('|')).toString(36);
}

/**
 * Prompt-hash-keyed semantic cache with a 60s TTL, cleared on failure so a retry
 * re-populates.
 *
 * D16: bounded memory without a timer. The sweep runs at most once per TTL
 * window rather than on every write — `settle` is on the innermost LM path, and
 * a per-write `purgeExpired` walked the whole map per completion to reclaim
 * entries a read would have reclaimed anyway, since `BoundedMap` treats an
 * expired entry as absent on every read. Reclaiming within one TTL period is the
 * same bound to within a factor of the call rate, and it is amortized O(1) per
 * write instead of O(size).
 */
export class ResponseCache {
  readonly #cache: LruCache<string, string>;
  readonly #ttlMs: number;
  readonly #now: Clock;
  #sweptAt: number;

  constructor(opts: { ttlMs?: number; now?: Clock } = {}) {
    this.#ttlMs = opts.ttlMs ?? CACHE_TTL_MS;
    this.#now = opts.now ?? Date.now;
    this.#sweptAt = this.#now();
    this.#cache = new LruCache<string, string>({ ttlMs: this.#ttlMs, now: this.#now });
  }

  /** Entries the map holds — live, plus any expired not yet swept. */
  get size(): number {
    return this.#cache.size();
  }

  get(key: string): string | undefined {
    return this.#cache.get(key);
  }

  set(key: string, value: string): void {
    if (this.#now() - this.#sweptAt >= this.#ttlMs) {
      this.#cache.purgeExpired();
      this.#sweptAt = this.#now();
    }
    this.#cache.set(key, value);
  }

  clear(key: string): void {
    this.#cache.delete(key);
  }
}
