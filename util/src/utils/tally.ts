/**
 * One tally of attempts: how many there were, how many succeeded, how long they
 * took.
 *
 * Five sites in the tree answered "did that work, and how fast" with counters of
 * their own — the LM per-model stats, the per-tool feedback, the per-rule stats,
 * the rule graph's latency, and the metacognitive monitor's performance history.
 * Two spelled the success rate `successfulCalls / totalCalls`, one kept a running
 * mean of durations, one an EWMA, and one recorded no count at all; two carried
 * columns nothing ever read. So the same question had four answers, none of them
 * comparable with another, and each tally lived in an unbounded `Map` keyed by
 * whatever the caller happened to hold.
 *
 * `CallTally` is the shape and {@link recordCall} is the update rule.
 * {@link CallTallySeries} is the bounded map of them, so a caller keyed by rule
 * id, tool name or model id inherits a capacity instead of writing its own.
 */

import type { BoundedMapOptions } from './bounded-map.js';
import { BoundedMap } from './bounded-map.js';
import type { Clock } from './clock.js';
import { systemClock } from './clock.js';
import type { BoundedContainer } from './collections.js';
import { getOrInsert } from './collections.js';

/** The counters one attempt changes. Every field is derived on record. */
export interface CallTally {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  /** Summed duration in ms — what `averageDuration` is divided out of. */
  totalDuration: number;
  /** Mean duration over `totalCalls`, in ms. */
  averageDuration: number;
  /** 0 before the first call. */
  successRate: number;
  /** Epoch ms of the most recent {@link recordCall}. */
  lastCalled: number;
}

/** The zeroed counters — the state before the first recorded attempt. */
export const createCallTally = (): CallTally => ({
  totalCalls: 0,
  successfulCalls: 0,
  failedCalls: 0,
  totalDuration: 0,
  averageDuration: 0,
  successRate: 0,
  lastCalled: 0,
});

/** Fold one attempt into `tally`, in place, and hand it back for chaining. */
export const recordCall = <T extends CallTally>(
  tally: T,
  success: boolean,
  durationMs: number,
  at: number = systemClock()
): T => {
  tally.totalCalls++;
  if (success) tally.successfulCalls++;
  else tally.failedCalls++;
  tally.totalDuration += durationMs;
  tally.averageDuration = tally.totalDuration / tally.totalCalls;
  tally.successRate = tally.successfulCalls / tally.totalCalls;
  tally.lastCalled = at;
  return tally;
};

/**
 * A {@link CallTally} plus whatever the caller keeps beside it — the last result
 * of a tool call, the id a series is already keyed by. `create` mints it, so the
 * series never has to guess a field it cannot see.
 */
export interface CallTallySeriesOptions<K = unknown, T extends CallTally = CallTally>
  extends BoundedMapOptions<K, T> {
  create: (key: K) => T;
}

/**
 * A capacity-bounded map of per-key tallies.
 *
 * Least-recently-used by default, so a hot key keeps its history while a stream
 * of one-shot keys cannot grow the map past its capacity. A site that wants its
 * history to age out rather than be evicted passes `ttlMs`; one that wants the
 * coldest key gone first passes `eviction`.
 */
export class CallTallySeries<K, T extends CallTally = CallTally>
  implements Iterable<[K, T]>, BoundedContainer<T>
{
  readonly #tallies: BoundedMap<K, T>;
  readonly #now: Clock;
  readonly #create: (key: K) => T;

  constructor(options: CallTallySeriesOptions<K, T>) {
    this.#now = options.now ?? systemClock;
    this.#create = options.create;
    this.#tallies = new BoundedMap<K, T>(options);
  }

  get capacity(): number {
    return this.#tallies.maxSize;
  }

  size(): number {
    return this.#tallies.size();
  }

  /** Occupancy in `0..1` — the AIKR pressure signal the bounded containers report. */
  pressure(): number {
    return this.#tallies.pressure();
  }

  clear(): void {
    this.#tallies.clear();
  }

  /** Fold one attempt into `key`'s tally, minting it on first sight. */
  record(key: K, success: boolean, durationMs: number): T {
    return recordCall(this.getOrInsert(key), success, durationMs, this.#now());
  }

  /**
   * The live tally, minted on first sight — the series' answer to util's
   * `getOrInsert`, for a caller folding in facts {@link record} does not model.
   * The LM accounting keeps token spend beside the call counters, so it needs the
   * record without wanting another attempt counted.
   */
  getOrInsert(key: K): T {
    return getOrInsert(this.#tallies, key, () => this.#create(key));
  }

  /** The live tally. Mutating it is the caller's; the series owns only the map. */
  get(key: K): T | undefined {
    return this.#tallies.get(key);
  }

  has(key: K): boolean {
    return this.#tallies.has(key);
  }

  /** Forget one key, or all of them. */
  reset(key?: K): void {
    if (key === undefined) this.clear();
    else this.#tallies.delete(key);
  }

  *keys(): Generator<K> {
    yield* this.#tallies.keys();
  }

  *values(): IterableIterator<T> {
    yield* this.#tallies.values();
  }

  *entries(): Generator<[K, T]> {
    yield* this.#tallies.entries();
  }

  [Symbol.iterator](): Generator<[K, T]> {
    return this.entries();
  }
}
