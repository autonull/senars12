import type { Bag, BagItem, BagOptions, EvictStrategy, AIKRBudget } from './Bag.js';
import type { RandomSource } from '../types/primitives.js';

interface FenwickEntry<T extends BagItem> {
  item: T;
  createdAt: number;
  lastAccessedAt: number;
}

export class FenwickBag<T extends BagItem> implements Bag<T> {
  version = 0;
  readonly capacity: number;
  private decayRate: number;
  private readonly forgetRate: number;
  private readonly rng: RandomSource;
  private _entries: FenwickEntry<T>[] = [];
  private tree: number[] = [];
  private totalPriority = 0;
  private idToIndex = new Map<string, number>();

  get decayRateValue(): number {
    return this.decayRate;
  }

  set decayRateValue(value: number) {
    this.decayRate = Math.max(0, Math.min(1, value));
  }

  constructor(options: BagOptions) {
    this.capacity = options.capacity;
    this.decayRate = options.decayRate ?? 0.01;
    this.forgetRate = options.forgetRate ?? 0.001;
    this.rng = options.rng ?? Math.random;
  }

  private addToTree(index: number, value: number): void {
    let i = index + 1;
    while (i <= this.capacity) {
      this.tree[i]! += value;
      i += i & -i;
    }
  }

  private queryTree(index: number): number {
    let sum = 0;
    let i = index + 1;
    while (i > 0) {
      sum += this.tree[i]!;
      i -= i & -i;
    }
    return sum;
  }

  private findByPrefixSum(target: number): number {
    let idx = 0;
    let bitMask = 1;
    while (bitMask < this.tree.length) bitMask <<= 1;
    for (let step = bitMask; step > 0; step >>= 1) {
      const next = idx + step;
      if (next < this.tree.length && this.tree[next]! < target) {
        idx = next;
        target -= this.tree[idx]!;
      }
    }
    return idx;
  }

  private rebuildTree(): void {
    this.tree = new Array(this._entries.length + 1).fill(0);
    for (let i = 0; i < this._entries.length; i++) {
      this.addToTree(i, this._entries[i]!.item.priority);
    }
  }

  private updateIdMap(): void {
    this.idToIndex.clear();
    for (let i = 0; i < this._entries.length; i++) {
      this.idToIndex.set(this._entries[i]!.item.id, i);
    }
  }

  add(item: T): boolean {
    if (this.capacity === 0) return false;

    const now = Date.now();
    const entry: FenwickEntry<T> = {
      item,
      createdAt: now,
      lastAccessedAt: now,
    };

    if (this._entries.length >= this.capacity) {
      if (!this.shouldOverflow(item.priority)) return false;
    }

    const insertIdx = this._entries.findIndex((e) => e.item.priority < item.priority);
    if (insertIdx === -1) {
      this._entries.push(entry);
      this.tree.push(0);
      this.addToTree(this._entries.length - 1, item.priority);
    } else {
      this._entries.splice(insertIdx, 0, entry);
      this.tree.push(0);
      this.rebuildTree();
    }

    this.totalPriority += item.priority;
    this.updateIdMap();
    this.version++;
    return true;
  }

  sample(): T | undefined {
    if (this._entries.length === 0) return undefined;

    if (this.totalPriority <= 0) {
      this.recalcTotalPriority();
      if (this.totalPriority <= 0) return this._entries[0]?.item;
    }

    const r = this.rng() * this.totalPriority;
    const idx = this.findByPrefixSum(r);
    if (idx >= this._entries.length) return this._entries[0]?.item;

    const entry = this._entries[idx]!;
    entry.lastAccessedAt = Date.now();
    return entry.item;
  }

  remove(idOrItem: string | T): boolean {
    let idx: number;
    if (typeof idOrItem === 'string') {
      idx = this.idToIndex.get(idOrItem) ?? -1;
    } else {
      idx = this._entries.findIndex((e) => e.item === idOrItem);
    }
    if (idx >= 0) {
      const priority = this._entries[idx]!.item.priority;
      this.addToTree(idx, -priority);
      this.totalPriority -= priority;
      this._entries.splice(idx, 1);
      this.tree.pop();
      this.updateIdMap();
      this.version++;
      return true;
    }
    return false;
  }

  decay(rate?: number): void {
    const applied = rate ?? this.decayRate;
    let newTotal = 0;
    const newEntries: FenwickEntry<T>[] = [];

    for (const entry of this._entries) {
      entry.item.priority *= 1 - applied;
      if (entry.item.priority >= this.forgetRate) {
        newEntries.push(entry);
        newTotal += entry.item.priority;
      }
    }

    this._entries = newEntries;
    this.totalPriority = newTotal;
    this.rebuildTree();
    this.updateIdMap();
    this.version++;
  }

  size(): number {
    return this._entries.length;
  }

  find(predicate: (item: T) => boolean): T | undefined {
    for (const entry of this._entries) {
      if (predicate(entry.item)) return entry.item;
    }
    return undefined;
  }

  removeMany(predicate: (item: T) => boolean): number {
    let removed = 0;
    for (let i = this._entries.length - 1; i >= 0; i--) {
      if (predicate(this._entries[i]!.item)) {
        const priority = this._entries[i]!.item.priority;
        this.addToTree(i, -priority);
        this.totalPriority -= priority;
        this._entries.splice(i, 1);
        removed++;
      }
    }
    this.tree = this.tree.slice(0, this._entries.length + 1);
    this.updateIdMap();
    if (removed > 0) this.version++;
    return removed;
  }

  forEach(fn: (item: T) => void): void {
    for (const entry of this._entries) {
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
    return this.capacity === 0 ? 1 : Math.min(1, this._entries.length / this.capacity);
  }

  evict(strategy: EvictStrategy = 'LowestPriority'): void {
    if (this._entries.length === 0) return;
    switch (strategy) {
      case 'LowestPriority': {
        const idx = this._entries.length - 1;
        this.addToTree(idx, -this._entries[idx]!.item.priority);
        this.totalPriority -= this._entries[idx]!.item.priority;
        this._entries.pop();
        this.tree.pop();
        this.updateIdMap();
        this.version++;
        break;
      }
      case 'LRU': {
        this._entries.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
        const idx = this._entries.length - 1;
        this.addToTree(idx, -this._entries[idx]!.item.priority);
        this.totalPriority -= this._entries[idx]!.item.priority;
        this._entries.pop();
        this.tree.pop();
        this.updateIdMap();
        this.version++;
        break;
      }
      case 'Random': {
        const idx = Math.floor(this.rng() * this._entries.length);
        this.addToTree(idx, -this._entries[idx]!.item.priority);
        this.totalPriority -= this._entries[idx]!.item.priority;
        this._entries.splice(idx, 1);
        this.tree.pop();
        this.rebuildTree();
        this.updateIdMap();
        this.version++;
        break;
      }
    }
  }

  *all(): IterableIterator<T> {
    for (const entry of this._entries) {
      yield entry.item;
    }
  }

  *entries(): IterableIterator<[T, number]> {
    for (const entry of this._entries) {
      yield [entry.item, entry.item.priority];
    }
  }

  private shouldOverflow(priority: number): boolean {
    if (this._entries.length === 0) return true;
    const minPriority = this._entries[this._entries.length - 1]!.item.priority;
    if (priority <= minPriority) return false;

    this.totalPriority -= minPriority;
    this.addToTree(this._entries.length - 1, -minPriority);
    this._entries.pop();
    this.tree.pop();
    this.updateIdMap();
    return true;
  }

  private recalcTotalPriority(): void {
    this.totalPriority = 0;
    for (const entry of this._entries) {
      this.totalPriority += entry.item.priority;
    }
  }

  clear(): void {
    this._entries = [];
    this.tree = [0];
    this.totalPriority = 0;
    this.idToIndex.clear();
    this.version++;
  }

  peek(): T | undefined {
    return this._entries[0]?.item;
  }

  toArray(): T[] {
    return this._entries.map((e) => e.item);
  }
}