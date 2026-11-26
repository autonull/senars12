/**
 * AIKR Bag — the unified priority bag substrate.
 *
 * This is the single bag implementation used by every layer:
 * the NAR's attention bags, the focus bags, the drive bags,
 * the learning bags, the proposal bags, and the mining bags.
 * One substrate, one policy, one import.
 */

import { SenarsError } from '../errors/senars-error';
import { createLogger } from './logger';

const logger = createLogger({ scope: 'util:bag' });

/** Histogram for tracking distributions. */
export interface Histogram {
  readonly edges: readonly number[];
  readonly counts: readonly number[];
  readonly total: number;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  /** Record a value. */
  record?(value: number): void;
  /** Get percentile. */
  percentile?(p: number): number;
  /** Clear the histogram. */
  clear?(): void;
}

/** The item a bag holds. */
export interface BagItem {
  readonly id: string;
  priority: number;
  readonly decayRate?: number;
  readonly forgetRate?: number;
  readonly stamp?: unknown;
}

/** Options to configure a bag instance. */
export interface BagOptions {
  /** Maximum items the bag holds. Required. */
  capacity: number;
  /** Called when pressure crosses a threshold (eviction, warning, etc.). */
  onPressure?: (transition: PressureTransition) => void;
  /** Clock for time-dependent policies. Defaults to system clock. */
  clock?: () => number;
  /** RNG for stochastic policies. Defaults to ambient. */
  rng?: RandomSource;
  /** Base decay rate for all items (per second). Defaults to 0. */
  decayRate?: number;
  /** Base forget rate for all items (per second). Defaults to 0. */
  forgetRate?: number;
  /** Unique bag identifier for events. Defaults to generated id. */
  id?: string;
  /** Eviction strategy when capacity is reached. Defaults to 'priority'. */
  evictStrategy?: EvictStrategy;
}

/** How the bag reacts when it is over capacity. */
export type EvictStrategy = 'priority' | 'fifo' | 'lru' | 'random';

/** Internal entry with bag-managed fields. */
export interface InternalEntry<T extends BagItem> extends BagItem {
  readonly _insertedAt: number;
  readonly _lastAccessedAt: number;
  readonly _accessCount: number;
  _currentPriority: number;
  /** The original item, preserving methods and non-enumerable properties. */
  readonly _item: T;
}

/** The pressure level the bag reports. */
export type PressureLevel = 'normal' | 'elevated' | 'critical';

/** A pressure transition event. */
export interface PressureTransition {
  bagId: string;
  pressure: PressureLevel;
  capacity: number;
  size: number;
  transition: 'normal->elevated' | 'elevated->critical' | 'critical->elevated' | 'elevated->normal';
}

/** Listener for pressure transitions. */
export type PressureListener = (transition: PressureTransition) => void;

/** A bag with cycle-oriented budget (focus, drives). */
export interface CyclesBudget {
  cycles: number;
  depth?: number;
}

import type { RandomSource } from './random';
import { shuffleInPlace, ambientRng, weightedSample } from './random';

/** Random source for bag operations (re-exported from random). */
export type { RandomSource };

/** The bag interface — what a bag is, not how it works. */
export interface Bag<T extends BagItem> {
  /** The bag's unique identifier. */
  readonly id: string;
  /** Current number of items. */
  readonly size: number;
  /** Configured capacity. */
  readonly capacity: number;
  /** Get current pressure level. */
  pressure(): PressureLevel;
  /** Base decay rate for all items (per second). */
  decayRateValue: number;
  /** Base forget rate for all items (per second). */
  forgetRateValue?: number;
  /** Add an item; returns false if eviction failed or item rejected. */
  add(item: T): boolean;
  /** Remove an item by id. */
  remove(id: string): boolean;
  /** Remove all items matching a predicate. */
  removeAll(predicate: (item: T) => boolean): number;
  /** Alias for removeAll. */
  removeMany(predicate: (item: T) => boolean): number;
  /** Get an item by id. */
  get(id: string): T | undefined;
  /** Get all items as array, sorted by priority descending. */
  all(): T[];
  /** Get all items as array (alias for all()). */
  toArray(): T[];
  /** Get all items as iterator. */
  values(): IterableIterator<T>;
  /** Iterate entries as [item, priority] pairs. */
  entries(): IterableIterator<[T, number]>;
  /** Update an item's priority. */
  updatePriority(id: string, priority: number): boolean;
  /** Set the eviction strategy. */
  setEvictStrategy(strategy: EvictStrategy): void;
  /** Evict one item using the given strategy (or current strategy if not provided). */
  evict(strategy?: EvictStrategy): boolean;
  /** Decay all priorities by the configured rate. */
  decay(): void;
  /** Sample items from the bag (priority-proportional). */
  sample(count: number): T[];
  /** Get the highest-priority item without removing it. */
  peek(): T | undefined;
  /** Find first item matching predicate. */
  find(predicate: (item: T) => boolean): T | undefined;
  /** Get the bag version (for synchronization). */
  readonly version: number;
  /** Register a pressure listener. */
  onPressure(listener: PressureListener): () => void;
  /** Clear all items. */
  clear(): void;
}

/** Bounded priority bag — the one implementation. */
export class PriorityBag<T extends BagItem> implements Bag<T> {
  readonly id: string;
  readonly capacity: number;
  #evictStrategy: EvictStrategy;
  readonly #clock: () => number;
  readonly #rng: RandomSource;
  #decayRate: number;
  #forgetRate: number;
  #onPressure?: PressureListener;
  #items = new Map<string, InternalEntry<T>>();
  #pressure: PressureLevel = 'normal';
  #version = 0;
  #sortedCache: T[] | null = null;
  #sortedDirty = true;

  // Cached prefix sums for fast weighted sampling
  #sampleCacheVersion = 0;
  #prefixSums: number[] | null = null;
  #prefixSumItems: T[] | null = null;

  // Incremental tracking for O(1) eviction
  #minPriorityEntry: InternalEntry<T> | null = null;
  // O(1) peek cache - tracks the max priority entry
  #peekCache: InternalEntry<T> | null = null;
  #oldestEntry: InternalEntry<T> | null = null;
  #lruEntry: InternalEntry<T> | null = null;

  #invalidateCache(): void {
    this.#sortedDirty = true;
    this.#sortedCache = null;
    this.#peekCache = null;
    this.#sampleCacheVersion = 0;
    this.#prefixSums = null;
    this.#prefixSumItems = null;
  }

  #ensureSorted(): T[] {
    if (this.#sortedDirty) {
      this.#sortedCache = Array.from(this.#items.values())
        .sort((a, b) => b._currentPriority - a._currentPriority)
        .map((entry) => entry._item);
      this.#sortedDirty = false;
    }
    return this.#sortedCache!;
  }

  #updateMinPriority(entry: InternalEntry<T>, isNew = false): void {
    if (this.#minPriorityEntry === null || entry._currentPriority < this.#minPriorityEntry._currentPriority) {
      this.#minPriorityEntry = entry;
    } else if (!isNew && this.#minPriorityEntry._currentPriority !== entry._currentPriority) {
      // The min was updated, may need to rescan if this was the min
      if (this.#minPriorityEntry === entry) {
        this.#recomputeMinPriority();
      }
    }
  }

  #recomputeMinPriority(): void {
    let min: InternalEntry<T> | null = null;
    for (const entry of this.#items.values()) {
      if (min === null || entry._currentPriority < min._currentPriority) {
        min = entry;
      }
    }
    this.#minPriorityEntry = min;
  }

  #updateOldest(entry: InternalEntry<T>, isNew = false): void {
    if (this.#oldestEntry === null || entry._insertedAt < this.#oldestEntry._insertedAt) {
      this.#oldestEntry = entry;
    } else if (!isNew && this.#oldestEntry._insertedAt !== entry._insertedAt) {
      if (this.#oldestEntry === entry) {
        this.#recomputeOldest();
      }
    }
  }

  #recomputeOldest(): void {
    let oldest: InternalEntry<T> | null = null;
    for (const entry of this.#items.values()) {
      if (oldest === null || entry._insertedAt < oldest._insertedAt) {
        oldest = entry;
      }
    }
    this.#oldestEntry = oldest;
  }

  #updateLRU(entry: InternalEntry<T>, isNew = false): void {
    if (this.#lruEntry === null || entry._lastAccessedAt < this.#lruEntry._lastAccessedAt) {
      this.#lruEntry = entry;
    } else if (!isNew && this.#lruEntry._lastAccessedAt !== entry._lastAccessedAt) {
      if (this.#lruEntry === entry) {
        this.#recomputeLRU();
      }
    }
  }

  #recomputeLRU(): void {
    let lru: InternalEntry<T> | null = null;
    for (const entry of this.#items.values()) {
      if (lru === null || entry._lastAccessedAt < lru._lastAccessedAt) {
        lru = entry;
      }
    }
    this.#lruEntry = lru;
  }

  #removeTracking(entry: InternalEntry<T>): void {
    if (this.#minPriorityEntry === entry) this.#recomputeMinPriority();
    if (this.#oldestEntry === entry) this.#recomputeOldest();
    if (this.#lruEntry === entry) this.#recomputeLRU();
  }

  #updateTrackingOnAdd(entry: InternalEntry<T>): void {
    this.#updateMinPriority(entry, true);
    this.#updateOldest(entry, true);
    this.#updateLRU(entry, true);
    this.#updatePeekCache(entry);
  }

  #updateTrackingOnUpdate(entry: InternalEntry<T>): void {
    this.#updateMinPriority(entry);
    this.#updateOldest(entry);
    this.#updateLRU(entry);
    this.#updatePeekCache(entry);
  }

  #updatePeekCache(entry: InternalEntry<T>): void {
    if (this.#peekCache === null || entry._currentPriority > this.#peekCache._currentPriority) {
      this.#peekCache = entry;
    }
  }

  constructor(options: BagOptions) {
    if (!options.capacity || options.capacity <= 0) {
      throw new SenarsError('Bag capacity must be a positive number', 'VALIDATION_ERROR', { capacity: options.capacity });
    }
    this.id = options.id ?? `bag-${Date.now()}-${ambientRng().toString(36).slice(2, 8)}`;
    this.capacity = options.capacity;
    this.#evictStrategy = options.evictStrategy ?? 'priority';
    this.#clock = options.clock ?? (() => Date.now());
    this.#rng = options.rng ?? ambientRng;
    this.#decayRate = options.decayRate ?? 0;
    this.#forgetRate = options.forgetRate ?? 0;
    this.#onPressure = options.onPressure;
  }

  get size(): number {
    return this.#items.size;
  }

  pressure(): PressureLevel {
    return this.#pressure;
  }

  get version(): number {
    return this.#version;
  }

  get decayRateValue(): number {
    return this.#decayRate;
  }

  set decayRateValue(value: number) {
    this.#decayRate = value;
  }

  get forgetRateValue(): number | undefined {
    return this.#forgetRate || undefined;
  }

  set forgetRateValue(value: number | undefined) {
    this.#forgetRate = value ?? 0;
  }

  add(item: T): boolean {
    const now = this.#clock();
    const entry: InternalEntry<T> = {
      ...item,
      _insertedAt: now,
      _lastAccessedAt: now,
      _accessCount: 0,
      _currentPriority: item.priority,
      _item: item,
    };

    // Evict if at capacity
    if (this.#items.size >= this.capacity) {
      // For 'priority' strategy, only admit if new item beats the lowest (strictly)
      if (this.#evictStrategy === 'priority') {
        if (this.#minPriorityEntry !== null && item.priority < this.#minPriorityEntry._currentPriority) {
          return false;
        }
      }
      const evicted = this.#evict();
      if (!evicted) return false;
    }

    this.#items.set(item.id, entry);
    this.#updateTrackingOnAdd(entry);
    this.#version++;
    this.#invalidateCache();
    this.#updatePressure();
    return true;
  }

  remove(id: string): boolean {
    const entry = this.#items.get(id);
    const result = this.#items.delete(id);
    if (result) {
      if (entry) {
        this.#removeTracking(entry);
        if (this.#peekCache === entry) {
          this.#peekCache = null;
        }
      }
      this.#version++;
      this.#invalidateCache();
      this.#updatePressure();
    }
    return result;
  }

  removeAll(predicate: (item: T) => boolean): number {
    let count = 0;
    let peekInvalidated = false;
    for (const [id, entry] of this.#items) {
      if (predicate(entry._item)) {
        this.#items.delete(id);
        this.#removeTracking(entry);
        if (this.#peekCache === entry) {
          peekInvalidated = true;
        }
        count++;
      }
    }
    if (count > 0) {
      if (peekInvalidated) this.#peekCache = null;
      this.#version++;
      this.#invalidateCache();
      this.#updatePressure();
    }
    return count;
  }

  removeMany(predicate: (item: T) => boolean): number {
    return this.removeAll(predicate);
  }

  get(id: string): T | undefined {
    const entry = this.#items.get(id);
    if (entry) {
      // Update access metadata
      const now = this.#clock();
      const updated: InternalEntry<T> = {
        ...entry,
        _lastAccessedAt: now,
        _accessCount: entry._accessCount + 1,
        _item: entry._item,
      };
      this.#items.set(id, updated);
      this.#updateLRU(updated);
      return entry._item;
    }
    return undefined;
  }

  all(): T[] {
    return this.#ensureSorted();
  }

  values(): IterableIterator<T> {
    const entries = this.#items.values();
    return {
      [Symbol.iterator](): IterableIterator<T> {
        return this;
      },
      next(): IteratorResult<T> {
        const result = entries.next();
        return result.done
          ? { done: true, value: undefined }
          : { done: false, value: result.value._item };
      },
    };
  }

  updatePriority(id: string, priority: number): boolean {
    const entry = this.#items.get(id);
    if (!entry) return false;
    const updated: InternalEntry<T> = {
      ...entry,
      _currentPriority: priority,
      priority,
      _item: entry._item,
    };
    this.#items.set(id, updated);
    this.#updateTrackingOnUpdate(updated);
    this.#version++;
    this.#sortedDirty = true;
    this.#sortedCache = null;
    return true;
  }

  setEvictStrategy(strategy: EvictStrategy): void {
    if (!['priority', 'fifo', 'lru', 'random'].includes(strategy)) {
      throw new SenarsError(`Invalid evict strategy: ${strategy}`, 'VALIDATION_ERROR', { strategy });
    }
    logger.warn(`Evict strategy change to ${strategy} not fully supported on live bag`);
  }

  decay(): void {
    if (this.#decayRate <= 0 && this.#forgetRate <= 0) return;
    const now = this.#clock();
    let hasChanges = false;
    let newPeekEntry: InternalEntry<T> | null = null;

    for (const [id, entry] of this.#items) {
      const ageSeconds = (now - entry._insertedAt) / 1000;
      const decay = this.#decayRate * ageSeconds;
      const forget = this.#forgetRate * ageSeconds;
      const originalPriority = entry._item.priority;
      const newPriority = Math.max(0, originalPriority - decay - forget);
      if (newPriority <= 0) {
        this.#items.delete(id);
        this.#removeTracking(entry);
        hasChanges = true;
      } else if (newPriority !== entry._currentPriority) {
        entry._currentPriority = newPriority;
        entry.priority = newPriority;
        if (newPeekEntry === null || newPriority > newPeekEntry._currentPriority) {
          newPeekEntry = entry;
        }
        hasChanges = true;
      } else if (newPeekEntry === null || newPriority > newPeekEntry._currentPriority) {
        newPeekEntry = entry;
      }
    }

    if (hasChanges) {
      this.#peekCache = newPeekEntry;
      this.#version++;
      this.#invalidateCache();
      this.#updatePressure();
    } else if (newPeekEntry !== null) {
      this.#peekCache = newPeekEntry;
    }
  }

  sample(count: number): T[] {
    const items = this.#ensureSorted();
    if (items.length <= count) return items;

    // Build or reuse prefix sums for O(log n) per draw
    if (this.#sampleCacheVersion !== this.#version || this.#prefixSums === null) {
      const validItems: T[] = [];
      const prefixSums: number[] = [];
      let sum = 0;
      for (const item of items) {
        const p = item.priority;
        if (p > 0) {
          validItems.push(item);
          sum += p;
          prefixSums.push(sum);
        }
      }
      this.#prefixSumItems = validItems;
      this.#prefixSums = prefixSums;
      this.#sampleCacheVersion = this.#version;
    }

    const validItems = this.#prefixSumItems!;
    const prefixSums = this.#prefixSums!;
    if (validItems.length === 0) return [];

    // Binary search sampling without replacement
    const n = validItems.length;
    const picked: T[] = [];
    const drawn = new Uint8Array(n); // 0 = available, 1 = drawn
    const total = prefixSums[n - 1]!;

    for (let draw = 0; draw < count && draw < n; draw++) {
      const roll = this.#rng() * total;

      // Binary search for the index
      let lo = 0;
      let hi = n - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (prefixSums[mid]! < roll) lo = mid + 1;
        else hi = mid;
      }
      let idx = lo;

      // Find next available (not drawn) item
      while (idx < n && drawn[idx]) idx++;
      if (idx >= n) break; // No more available items

      drawn[idx] = 1;
      picked.push(validItems[idx]!);
    }

    return picked;
  }

  /** Get all items as array (alias for all()). */
  toArray(): T[] {
    return this.all();
  }

  /** Iterate entries as [item, priority] pairs. */
  entries(): IterableIterator<[T, number]> {
    const entries = this.#items.entries();
    return {
      [Symbol.iterator](): IterableIterator<[T, number]> {
        return this;
      },
      next(): IteratorResult<[T, number]> {
        const result = entries.next();
        return result.done
          ? { done: true, value: undefined }
          : { done: false, value: [result.value[1]._item, result.value[1]._currentPriority] };
      },
    };
  }

  /** Get the highest-priority item without removing it. */
  peek(): T | undefined {
    if (this.#items.size === 0) return undefined;
    if (this.#peekCache !== null) {
      return this.#peekCache._item;
    }
    if (!this.#sortedDirty && this.#sortedCache && this.#sortedCache.length > 0) {
      return this.#sortedCache[0];
    }
    let bestEntry: InternalEntry<T> | null = null;
    let bestPriority = -Infinity;
    for (const entry of this.#items.values()) {
      if (entry._currentPriority > bestPriority) {
        bestPriority = entry._currentPriority;
        bestEntry = entry;
      }
    }
    this.#peekCache = bestEntry;
    return bestEntry?._item;
  }

  /** Find first item matching predicate. */
  find(predicate: (item: T) => boolean): T | undefined {
    for (const entry of this.#items.values()) {
      if (predicate(entry._item)) {
        return entry._item;
      }
    }
    return undefined;
  }

  onPressure(listener: PressureListener): () => void {
    const existing = this.#onPressure;
    this.#onPressure = (t) => {
      existing?.(t);
      listener(t);
    };
    return () => {
      if (this.#onPressure === listener) {
        this.#onPressure = undefined;
      } else if (this.#onPressure) {
        // Can't easily remove chained listener without more infrastructure
      }
    };
  }

  clear(): void {
    this.#items.clear();
    this.#minPriorityEntry = null;
    this.#oldestEntry = null;
    this.#lruEntry = null;
    this.#peekCache = null;
    this.#version++;
    this.#invalidateCache();
    this.#updatePressure();
  }

  /** Evict one item using the given strategy (or current strategy if not provided). */
  evict(strategy?: EvictStrategy): boolean {
    const originalStrategy = this.#evictStrategy;
    if (strategy) {
      this.#evictStrategy = strategy;
    }
    const result = this.#evict();
    if (strategy) {
      this.#evictStrategy = originalStrategy;
    }
    return result;
  }

  #evict(): boolean {
    if (this.#items.size === 0) return false;

    let victimId: string | null = null;

    switch (this.#evictStrategy) {
      case 'priority': {
        if (this.#minPriorityEntry !== null) {
          victimId = this.#minPriorityEntry.id;
        }
        break;
      }
      case 'fifo': {
        if (this.#oldestEntry !== null) {
          victimId = this.#oldestEntry.id;
        }
        break;
      }
      case 'lru': {
        if (this.#lruEntry !== null) {
          victimId = this.#lruEntry.id;
        }
        break;
      }
      case 'random': {
        const entries = Array.from(this.#items.keys());
        victimId = entries[Math.floor(this.#rng() * entries.length)]!;
        break;
      }
    }

    if (victimId) {
      const entry = this.#items.get(victimId);
      this.#items.delete(victimId);
      if (entry) {
        this.#removeTracking(entry);
        if (this.#peekCache === entry) {
          this.#peekCache = null;
        }
      }
      this.#version++;
      this.#invalidateCache();
      return true;
    }
    return false;
  }

  #updatePressure(): void {
    const utilization = this.#items.size / this.capacity;
    const newPressure: PressureLevel =
      utilization >= 0.95 ? 'critical' : utilization >= 0.75 ? 'elevated' : 'normal';

    if (newPressure !== this.#pressure) {
      const transition: PressureTransition = {
        bagId: this.id,
        pressure: newPressure,
        capacity: this.capacity,
        size: this.#items.size,
        transition: `${this.#pressure}->${newPressure}` as PressureTransition['transition'],
      };
      this.#pressure = newPressure;
      this.#onPressure?.(transition);
    }
  }
}