import type { AIKRBudget } from '@senars/core/budget';
import { emitDomainEvent } from '@senars/core/event-sink';
import {
  type Clock,
  clamp01,
  makeId,
  nextInt,
  occupancy,
  type RandomSource,
  weightedPick,
  BoundedContainer,
} from '@senars/util';
import { PRESSURE } from '../constants.js';
import { FenwickTree } from './fenwick.js';
import type { BagItem, InternalEntry } from './types.js';

export type { RandomSource } from '@senars/util';
export type { BagItem, InternalEntry } from './types.js';

export type BagImplementation = 'priority' | 'fenwick';

export interface BagOptions {
  capacity: number;
  decayRate?: number;
  forgetRate?: number;
  /** Injected randomness for sampling/eviction (default Math.random). */
  rng?: RandomSource;
  /** Bag implementation to use (default 'priority'). */
  implementation?: BagImplementation;
  /** Injected clock for createdAt/lastAccessedAt (default Date.now). */
  clock?: Clock;
  /** Optional identifier for observability. */
  id?: string;
}

export type EvictStrategy = 'LRU' | 'LowestPriority' | 'Random';

export type { AIKRBudget };

export interface Bag<T extends BagItem> {
  readonly capacity: number;
  /** The per-decay priority retention this bag was built with (`strategies.bag.config`). */
  decayRateValue: number;
  add(item: T): boolean;
  sample(): T | undefined;
  sampleMany(budget: AIKRBudget | number): T[];
  remove(idOrItem: string | T): boolean;
  decay(rate?: number): void;
  evict(strategy?: EvictStrategy): void;
  pressure(): number;
  size(): number;
  find(predicate: (item: T) => boolean): T | undefined;
  removeMany(predicate: (item: T) => boolean): number;
  forEach(fn: (item: T) => void): void;
  all(): IterableIterator<T>;
  entries(): IterableIterator<[T, number]>;
  version: number;
  clear(): void;
  peek(): T | undefined;
  toArray(): T[];
}

/**
 * Shared `Bag<T>` policy: capacity admission, decay, eviction, pressure, and
 * sampling bookkeeping. Subclasses supply only the storage and the derived
 * indexes (splice, weighted-pick, reindex) their backend maintains.
 */
export abstract class BaseBag<T extends BagItem> implements Bag<T>, BoundedContainer<T> {
  /** Increments on every structural mutation — consumers use it to invalidate derived indexes. */
  version = 0;
  readonly capacity: number;
  protected decayRate: number;
  protected readonly forgetRate: number;
  protected totalPriority = 0;
  protected readonly rng: RandomSource;
  protected readonly clock: () => number;
  protected readonly id: string;
  protected lastPressureLevel: 'normal' | 'high' | 'critical' = 'normal';

  /** Priority-descending entry store — the single source of ordering truth. */
  protected abstract get store(): InternalEntry<T>[];
  /** Insert into priority-descending order, maintaining any derived indexes. */
  protected abstract insertEntry(entry: InternalEntry<T>): void;
  /** Remove and return the entry at `index`, maintaining any derived indexes. */
  protected abstract eraseAt(index: number): InternalEntry<T>;
  /** Drop the lowest-priority tail entry, maintaining any derived indexes. */
  protected abstract dropLast(): void;
  /** Wholesale replacement after a bulk filter, maintaining any derived indexes. */
  protected abstract replaceAll(entries: InternalEntry<T>[]): void;
  /** Locate an entry by id or identity; -1 when absent. */
  protected abstract indexOf(idOrItem: string | T): number;
  /** Priority-weighted pick over the current store; no total-priority precheck. */
  protected abstract pickWeighted(): InternalEntry<T> | undefined;

  get decayRateValue(): number {
    return this.decayRate;
  }

  set decayRateValue(value: number) {
    this.decayRate = clamp01(value);
  }

  constructor(options: BagOptions) {
    this.capacity = options.capacity;
    this.decayRate = options.decayRate ?? 0.01;
    this.forgetRate = options.forgetRate ?? 0.001;
    this.rng = options.rng ?? Math.random;
    this.clock = options.clock ?? Date.now;
    // Identity, not a sample: drawn from the *id* seam so that constructing a
    // bag cannot shift the seeded stream that sampling and eviction replay from.
    this.id = options.id ?? makeId();
  }

  /** First index whose priority is below `priority` (binary search over the sorted store). */
  protected insertIndex(priority: number): number {
    const store = this.store;
    let lo = 0;
    let hi = store.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (store[mid]!.item.priority >= priority) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  add(item: T): boolean {
    if (this.capacity === 0) return false;
    if (this.store.length >= this.capacity && !this.shouldOverflow(item.priority)) return false;

    const now = this.clock();
    this.insertEntry({ item, createdAt: now, lastAccessedAt: now });
    this.totalPriority += item.priority;
    this.version++;
    return true;
  }

  sample(): T | undefined {
    if (this.store.length === 0) return undefined;
    if (this.totalPriority <= 0) {
      this.recalcTotalPriority();
      if (this.totalPriority <= 0) return this.store[0]?.item;
    }
    const entry = this.pickWeighted();
    if (!entry) return undefined;
    entry.lastAccessedAt = this.clock();
    return entry.item;
  }

  remove(idOrItem: string | T): boolean {
    const idx = this.indexOf(idOrItem);
    return idx < 0 ? false : this.dropAt(idx);
  }

  private dropAt(index: number): boolean {
    this.totalPriority -= this.store[index]!.item.priority;
    this.eraseAt(index);
    this.version++;
    return true;
  }

  decay(rate?: number): void {
    const factor = 1 - (rate ?? this.decayRate);
    const kept: InternalEntry<T>[] = [];
    let newTotal = 0;

    for (const entry of this.store) {
      entry.item.priority *= factor;
      if (entry.item.priority < this.forgetRate) entry.item.priority = 0;
      if (entry.item.priority > 0) {
        kept.push(entry);
        newTotal += entry.item.priority;
      }
    }

    this.totalPriority = newTotal;
    this.replaceAll(kept);
    this.version++;
  }

  size(): number {
    return this.store.length;
  }

  /** Iterate items in priority order (highest first) to satisfy {@link BoundedContainer}. */
  [Symbol.iterator](): IterableIterator<T> {
    return this.all();
  }

  find(predicate: (item: T) => boolean): T | undefined {
    for (const entry of this.store) {
      if (predicate(entry.item)) return entry.item;
    }
    return undefined;
  }

  removeMany(predicate: (item: T) => boolean): number {
    let removed = 0;
    for (let i = this.store.length - 1; i >= 0; i--) {
      if (predicate(this.store[i]!.item)) {
        this.dropAt(i);
        removed++;
      }
    }
    return removed;
  }

  forEach(fn: (item: T) => void): void {
    for (const entry of this.store) {
      fn(entry.item);
    }
  }

  sampleMany(budget: AIKRBudget | number): T[] {
    const n = typeof budget === 'number' ? budget : budget.cycles;
    const out: T[] = [];
    for (let i = 0; i < Math.max(0, Math.floor(n)); i++) {
      const item = this.sample();
      if (!item) break;
      out.push(item);
    }
    return out;
  }

  pressure(): number {
    const pressure = occupancy(this.store.length, this.capacity);
    this.checkPressureTransition(pressure);
    return pressure;
  }

  private checkPressureTransition(pressure: number): void {
    const level =
      pressure >= PRESSURE.CRITICAL ? 'critical' : pressure >= PRESSURE.HIGH ? 'high' : 'normal';
    if (level === this.lastPressureLevel) return;
    this.lastPressureLevel = level;
    emitDomainEvent('bag.pressure.transition', '', {
      bagId: this.id,
      pressure,
      capacity: this.capacity,
      size: this.store.length,
      transition: level,
    });
  }

  evict(strategy: EvictStrategy = 'LowestPriority'): void {
    const store = this.store;
    if (store.length === 0) return;
    switch (strategy) {
      case 'LowestPriority':
        this.totalPriority -= store[store.length - 1]!.item.priority;
        this.dropLast();
        this.version++;
        break;
      case 'LRU': {
        let lruIdx = 0;
        for (let i = 1; i < store.length; i++) {
          if (store[i]!.lastAccessedAt < store[lruIdx]!.lastAccessedAt) lruIdx = i;
        }
        this.dropAt(lruIdx);
        break;
      }
      case 'Random':
        this.dropAt(nextInt(this.rng, store.length));
        break;
    }
  }

  *all(): IterableIterator<T> {
    for (const entry of this.store) {
      yield entry.item;
    }
  }

  *entries(): IterableIterator<[T, number]> {
    for (const entry of this.store) {
      yield [entry.item, entry.item.priority];
    }
  }

  private shouldOverflow(priority: number): boolean {
    const store = this.store;
    if (store.length === 0) return true;
    const minPriority = store[store.length - 1]!.item.priority;
    if (priority <= minPriority) return false;

    this.totalPriority -= minPriority;
    this.dropLast();
    return true;
  }

  private recalcTotalPriority(): void {
    this.totalPriority = 0;
    for (const entry of this.store) {
      this.totalPriority += entry.item.priority;
    }
  }

  clear(): void {
    this.replaceAll([]);
    this.totalPriority = 0;
    this.version++;
  }

  peek(): T | undefined {
    return this.store[0]?.item;
  }

  toArray(): T[] {
    return this.store.map((e) => e.item);
  }
}

export class PriorityBag<T extends BagItem> extends BaseBag<T> {
  private heap: InternalEntry<T>[] = [];
  private fenwick = new FenwickTree<InternalEntry<T>>(0);

  protected get store(): InternalEntry<T>[] {
    return this.heap;
  }

  protected insertEntry(entry: InternalEntry<T>): void {
    const idx = this.insertIndex(entry.item.priority);
    this.heap.splice(idx, 0, entry);
    this.fenwick.resize(this.heap.length);
    this.fenwick.rebuild(this.heap);
  }

  protected eraseAt(index: number): InternalEntry<T> {
    const [removed] = this.heap.splice(index, 1);
    this.fenwick.resize(this.heap.length);
    this.fenwick.rebuild(this.heap);
    return removed!;
  }

  protected dropLast(): void {
    const removed = this.heap.pop()!;
    this.fenwick.resize(this.heap.length);
    this.fenwick.rebuild(this.heap);
  }

  protected replaceAll(entries: InternalEntry<T>[]): void {
    this.heap = entries;
    this.fenwick.resize(this.heap.length);
    this.fenwick.rebuild(this.heap);
  }

  protected indexOf(idOrItem: string | T): number {
    return typeof idOrItem === 'string'
      ? this.heap.findIndex((e) => e.item.id === idOrItem)
      : this.heap.findIndex((e) => e.item === idOrItem);
  }

  protected pickWeighted(): InternalEntry<T> | undefined {
    if (this.heap.length === 0 || this.totalPriority <= 0) return undefined;
    const target = this.rng() * this.totalPriority;
    const idx = this.fenwick.findByPrefixSum(target, this.heap.length);
    return this.heap[idx] ?? this.heap[0];
  }
}
