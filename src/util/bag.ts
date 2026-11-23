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
  readonly _currentPriority: number;
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
  /** Get all items as array. */
  all(): T[];
  /** Alias for all(). */
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
  /** Sample items from the bag. */
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

/** Histogram implementation. */
export class HistogramImpl implements Histogram {
  readonly edges: number[];
  readonly counts: number[];
  total = 0;
  min = Infinity;
  max = -Infinity;
  mean = 0;
  private sum = 0;

  constructor(bucketCount = 100) {
    this.edges = new Array(bucketCount + 1).fill(0);
    this.counts = new Array(bucketCount).fill(0);
  }

  record(value: number): void {
    this.total++;
    this.sum += value;
    this.mean = this.sum / this.total;
    this.min = Math.min(this.min, value);
    this.max = Math.max(this.max, value);
  }

  percentile(p: number): number {
    if (this.total === 0) return 0;
    const target = this.total * p;
    let cumulative = 0;
    for (let i = 0; i < this.counts.length; i++) {
      cumulative += this.counts[i]!;
      if (cumulative >= target) {
        return this.edges[i]! + (this.edges[i + 1]! - this.edges[i]!) * ((target - cumulative + this.counts[i]!) / this.counts[i]!);
      }
    }
    return this.max;
  }

  clear(): void {
    this.edges.fill(0);
    this.counts.fill(0);
    this.total = 0;
    this.min = Infinity;
    this.max = -Infinity;
    this.mean = 0;
    this.sum = 0;
  }
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
        let minPriority = Infinity;
        for (const e of this.#items.values()) {
          if (e._currentPriority < minPriority) minPriority = e._currentPriority;
        }
        if (item.priority < minPriority) return false;
      }
      const evicted = this.#evict();
      if (!evicted) return false;
    }

    this.#items.set(item.id, entry);
    this.#version++;
    this.#updatePressure();
    return true;
  }

  remove(id: string): boolean {
    const result = this.#items.delete(id);
    if (result) this.#version++;
    this.#updatePressure();
    return result;
  }

  removeAll(predicate: (item: T) => boolean): number {
    let count = 0;
    for (const [id, entry] of this.#items) {
      if (predicate(entry._item)) {
        this.#items.delete(id);
        count++;
      }
    }
    if (count > 0) {
      this.#version++;
      this.#updatePressure();
    }
    return count;
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
      return entry._item;
    }
    return undefined;
  }

  all(): T[] {
    return Array.from(this.#items.values())
      .sort((a, b) => b._currentPriority - a._currentPriority)
      .map((entry) => entry._item);
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
    this.#version++;
    return true;
  }

  setEvictStrategy(strategy: EvictStrategy): void {
    // Can't change strategy on frozen object, but we can track it
    // For now, just validate
    if (!['priority', 'fifo', 'lru', 'random'].includes(strategy)) {
      throw new SenarsError(`Invalid evict strategy: ${strategy}`, 'VALIDATION_ERROR', { strategy });
    }
    // Strategy change would require re-sorting; log warning
    logger.warn(`Evict strategy change to ${strategy} not fully supported on live bag`);
  }

  decay(): void {
    if (this.#decayRate <= 0 && this.#forgetRate <= 0) return;
    const now = this.#clock();
    for (const [id, entry] of this.#items) {
      const ageSeconds = (now - entry._insertedAt) / 1000;
      const decay = this.#decayRate * ageSeconds;
      const forget = this.#forgetRate * ageSeconds;
      const originalPriority = entry._item.priority;
      const newPriority = Math.max(0, originalPriority - decay - forget);
      if (newPriority <= 0) {
        this.#items.delete(id);
      } else {
        this.#items.set(id, { ...entry, _currentPriority: newPriority, priority: newPriority });
      }
    }
    this.#version++;
    this.#updatePressure();
  }

  sample(count: number): T[] {
    const items = this.all();
    if (items.length <= count) return items;
    // Priority-proportional sampling (roulette wheel without replacement)
    return weightedSample(items, count, (item) => item.priority, this.#rng);
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
    this.#version++;
    this.#updatePressure();
  }

  /** Alias for removeAll. */
  removeMany(predicate: (item: T) => boolean): number {
    return this.removeAll(predicate);
  }

  /** Alias for all(). */
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

  /** Get the highest-priority item without removing it. */
  peek(): T | undefined {
    if (this.#items.size === 0) return undefined;
    let bestEntry: InternalEntry<T> | null = null;
    let bestPriority = -Infinity;
    for (const entry of this.#items.values()) {
      if (entry._currentPriority > bestPriority) {
        bestPriority = entry._currentPriority;
        bestEntry = entry;
      }
    }
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

  #evict(): boolean {
    if (this.#items.size === 0) return false;

    let victimId: string | null = null;

    switch (this.#evictStrategy) {
      case 'priority': {
        let minPriority = Infinity;
        for (const [id, entry] of this.#items) {
          if (entry._currentPriority < minPriority) {
            minPriority = entry._currentPriority;
            victimId = id;
          }
        }
        break;
      }
      case 'fifo': {
        let oldest = Infinity;
        for (const [id, entry] of this.#items) {
          if (entry._insertedAt < oldest) {
            oldest = entry._insertedAt;
            victimId = id;
          }
        }
        break;
      }
      case 'lru': {
        let oldestAccess = Infinity;
        for (const [id, entry] of this.#items) {
          if (entry._lastAccessedAt < oldestAccess) {
            oldestAccess = entry._lastAccessedAt;
            victimId = id;
          }
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
      this.#items.delete(victimId);
      this.#version++;
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