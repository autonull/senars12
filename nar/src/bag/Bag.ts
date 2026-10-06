import type { AIKRBudget } from '@senars/core/budget';
import { emitDomainEvent } from '@senars/core/event-sink';
import {
  ambientRng,
  type BoundedContainer,
  type Clock,
  clamp01,
  makeId,
  minBy,
  nextInt,
  occupancy,
  type RandomSource,
  retain,
  sumBy,
  systemClock,
} from '@senars/util';
import { PRESSURE } from '../constants.js';
import { FenwickTree } from './fenwick.js';
import type { BagItem, InternalEntry } from './types.js';

export type { RandomSource } from '@senars/util';
export type { BagItem, InternalEntry } from './types.js';

export interface BagOptions {
  capacity: number;
  decayRate?: number;
  forgetRate?: number;
  /** Injected randomness for sampling/eviction (default `ambientRng`). */
  rng?: RandomSource;
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
  /** Drop every entry named by `ids` in one pass. A drain of k items is one walk of
   *  the store, not k of them. */
  removeAll(ids: Iterable<string>): number;
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
 * The AIKR priority bag: a priority-descending entry store with a Fenwick tree
 * over it. Capacity admission, decay, eviction, pressure and sampling are one
 * policy; the tree makes a weighted pick O(log n) and an append or a tail drop a
 * single point update. The tree is sized to `capacity + 1` once and mutated in
 * place — any other insert shifts a range of prefix sums, which a Fenwick tree
 * cannot express, so those set a staleness flag and the next read pays one
 * rebuild for the whole batch rather than one per insert.
 */
export class PriorityBag<T extends BagItem> implements Bag<T>, BoundedContainer<T> {
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

  /** The priority-descending entry store — the single source of ordering truth. */
  private list: InternalEntry<T>[] = [];
  private readonly fenwick: FenwickTree<InternalEntry<T>>;
  /** Set by a mutation the tree cannot absorb; cleared by the read that needs it. */
  private treeStale = true;

  private get store(): InternalEntry<T>[] {
    return this.list;
  }

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
    this.rng = options.rng ?? ambientRng;
    this.clock = options.clock ?? systemClock;
    // Identity, not a sample: drawn from the *id* seam so that constructing a
    // bag cannot shift the seeded stream that sampling and eviction replay from.
    this.id = options.id ?? makeId();
    this.fenwick = new FenwickTree<InternalEntry<T>>(options.capacity);
  }

  /** Fold every mutation since the last rebuild into one pass over the store. */
  private syncTree(): void {
    if (!this.treeStale) return;
    this.fenwick.rebuild(this.list);
    this.treeStale = false;
  }

  /**
   * An append is one new element at the tail, so a fresh tree takes a point
   * update. Any other insert shifts a *range* of prefix sums by the new
   * priority, and a Fenwick tree has no range-shift operation for that — a
   * prepend is not `add(0, p)`, which raises the head element instead of moving
   * the store down. Those defer the rebuild to the next pick, so a cycle that
   * admits many tasks pays it once.
   */
  private insertEntry(entry: InternalEntry<T>): void {
    const idx = this.insertIndex(entry.item.priority);
    this.list.splice(idx, 0, entry);
    if (!this.treeStale && idx === this.list.length - 1) this.fenwick.add(idx, entry.item.priority);
    else this.treeStale = true;
  }

  private eraseAt(index: number): InternalEntry<T> {
    const [removed] = this.list.splice(index, 1);
    this.treeStale = true;
    return removed!;
  }

  private dropLast(): void {
    const removed = this.list.pop()!;
    // Dropping the tail shifts no surviving index, so a fresh tree takes a point update.
    this.syncTree();
    this.fenwick.add(this.list.length, -removed.item.priority);
  }

  private replaceAll(entries: InternalEntry<T>[]): void {
    this.list = entries;
    this.treeStale = true;
  }

  private indexOf(idOrItem: string | T): number {
    return typeof idOrItem === 'string'
      ? this.list.findIndex((e) => e.item.id === idOrItem)
      : this.list.findIndex((e) => e.item === idOrItem);
  }

  /** Priority-weighted pick over the current store; no total-priority precheck. */
  private pickWeighted(): InternalEntry<T> | undefined {
    this.syncTree();
    const target = this.rng() * this.totalPriority;
    const idx = this.fenwick.findByPrefixSum(target, this.list.length);
    return this.list[idx] ?? this.list[0];
  }

  /** First index whose priority is below `priority` (binary search over the sorted store). */
  private insertIndex(priority: number): number {
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

  /**
   * Drop a named set of entries in one pass. The AIKR drain is the reason: a
   * processor removes each sampled item by id, and an id lookup is a linear scan of
   * the whole store, so draining a budget's worth of items from a full bag walked the
   * bag once per item. One filter, one tree rebuild, one version bump.
   */
  removeAll(ids: Iterable<string>): number {
    const doomed = new Set(ids);
    if (doomed.size === 0 || this.list.length === 0) return 0;
    const kept = this.list.filter((entry) => !doomed.has(entry.item.id));
    const dropped = this.list.length - kept.length;
    if (dropped === 0) return 0;
    this.totalPriority = sumBy(kept, (entry) => entry.item.priority);
    this.replaceAll(kept);
    this.version++;
    return dropped;
  }

  private dropAt(index: number): boolean {
    this.totalPriority -= this.store[index]!.item.priority;
    this.eraseAt(index);
    this.version++;
    return true;
  }

  decay(rate?: number): void {
    const decayRate = rate ?? this.decayRate;
    const kept: InternalEntry<T>[] = [];
    let newTotal = 0;

    for (const entry of this.store) {
      entry.item.priority = retain(entry.item.priority, decayRate);
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
        // Recency is the one order the priority sort does not already answer, so
        // it is the one order `minBy` is for.
        const lru = minBy(store.entries(), ([, entry]) => entry.lastAccessedAt);
        if (lru) this.dropAt(lru[0]);
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
