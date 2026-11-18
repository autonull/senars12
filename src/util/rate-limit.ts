/**
 * Keyed sliding-window rate limiting — the one admission clock behind the
 * transport middleware and the hand-rolled HTTP guards.
 *
 * A window is the newest `limit` arrival stamps in a `BoundedRing`, so the hot
 * path is O(1) with no allocation and no timer: an arrival is admitted when the
 * oldest retained stamp has aged out of `windowMs`. Key spaces are bounded by an
 * LRU of windows, so a caller that keys on request-supplied values cannot grow
 * the limiter without limit.
 */

import { type Clock, systemClock } from './clock.js';
import { BoundedRing, getOrInsert } from './collections.js';
import { LruCache } from './lru-cache.js';

export interface RateLimiterOptions {
  /** Arrivals admitted per `windowMs`. */
  limit: number;
  /** Window width in ms. */
  windowMs: number;
  /** Distinct keys retained; the least recently used window is dropped past it. Default: 1024. */
  maxKeys?: number;
  /** Injected clock (deterministic tests). */
  now?: Clock;
}

const DEFAULT_MAX_KEYS = 1024;

export class SlidingWindowRateLimiter {
  readonly #limit: number;
  readonly #windowMs: number;
  readonly #now: Clock;
  readonly #windows: LruCache<string, BoundedRing<number>>;

  constructor(options: RateLimiterOptions) {
    this.#limit = Math.max(1, options.limit);
    this.#windowMs = options.windowMs;
    this.#now = options.now ?? systemClock;
    this.#windows = new LruCache({ maxSize: options.maxKeys ?? DEFAULT_MAX_KEYS });
  }

  /** Record an arrival under `key` and report whether it fits the allowance. */
  tryAcquire(key = '', now = this.#now()): boolean {
    const displaced = getOrInsert(
      this.#windows,
      key,
      () => new BoundedRing<number>(this.#limit)
    ).push(now);
    return displaced === undefined || displaced <= now - this.#windowMs;
  }

  /** Forget one key's history, or all of it. */
  reset(key?: string): void {
    if (key === undefined) this.#windows.clear();
    else this.#windows.delete(key);
  }
}
