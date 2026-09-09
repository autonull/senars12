export interface BagItem {
  id: string;
  priority: number;
}

export interface BagOptions {
  capacity: number;
  decayRate?: number;
  forgetRate?: number;
}

export type EvictStrategy = 'LRU' | 'LowestPriority' | 'Random';

export interface AIKRBudget {
  cycles: number;
  depth?: number;
}

export interface Bag<T extends BagItem> {
  readonly capacity: number;
  add(item: T): boolean;
  sample(): T | undefined;
  sampleMany(budget: AIKRBudget | number): T[];
  remove(idOrItem: string | T): boolean;
  decay(rate?: number): void;
  evict(strategy?: EvictStrategy): void;
  pressure(): number;
  size(): number;
  find(predicate: (item: T) => boolean): T | undefined;
  forEach(fn: (item: T) => void): void;
  all(): IterableIterator<T>;
  entries(): IterableIterator<[T, number]>;
}

interface InternalEntry<T extends BagItem> {
  item: T;
  createdAt: number;
  lastAccessedAt: number;
}

export class PriorityBag<T extends BagItem> implements Bag<T> {
  readonly capacity: number;
  private decayRate: number;
  private readonly forgetRate: number;
  private heap: InternalEntry<T>[] = [];
  private totalPriority = 0;

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
  }

  add(item: T): boolean {
    if (this.capacity === 0) return false;

    const now = Date.now();
    const entry: InternalEntry<T> = {
      item,
      createdAt: now,
      lastAccessedAt: now,
    };

    if (this.heap.length >= this.capacity) {
      if (!this.shouldOverflow(item.priority)) return false;
    }

    const idx = this.heap.findIndex((e) => e.item.priority < item.priority);
    if (idx === -1) {
      this.heap.push(entry);
    } else {
      this.heap.splice(idx, 0, entry);
    }
    this.totalPriority += item.priority;
    return true;
  }

  sample(): T | undefined {
    if (this.heap.length === 0) return undefined;

    if (this.totalPriority <= 0) {
      this.recalcTotalPriority();
      if (this.totalPriority <= 0) return this.heap[0]?.item;
    }

    let r = Math.random() * this.totalPriority;
    for (let i = 0; i < this.heap.length; i++) {
      const e = this.heap[i];
      if (e) {
        r -= e.item.priority;
        if (r <= 0) {
          e.lastAccessedAt = Date.now();
          return e.item;
        }
      }
    }
    return this.heap[0]?.item;
  }

  remove(idOrItem: string | T): boolean {
    let idx: number;
    if (typeof idOrItem === 'string') {
      idx = this.heap.findIndex((e) => e.item.id === idOrItem);
    } else {
      idx = this.heap.findIndex((e) => e.item === idOrItem);
    }
    if (idx >= 0) {
      this.totalPriority -= this.heap[idx]!.item.priority;
      this.heap.splice(idx, 1);
      return true;
    }
    return false;
  }

  decay(rate?: number): void {
    const applied = rate ?? this.decayRate;
    let newTotal = 0;

    for (const entry of this.heap) {
      entry.item.priority *= 1 - applied;
      if (entry.item.priority < this.forgetRate) {
        entry.item.priority = 0;
      }
      newTotal += entry.item.priority;
    }

    this.heap = this.heap.filter((e) => e.item.priority > 0);
    this.totalPriority = newTotal;
  }

  size(): number {
    return this.heap.length;
  }

  find(predicate: (item: T) => boolean): T | undefined {
    for (const entry of this.heap) {
      if (predicate(entry.item)) return entry.item;
    }
    return undefined;
  }

  forEach(fn: (item: T) => void): void {
    for (const entry of this.heap) {
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
    return this.capacity === 0 ? 1 : Math.min(1, this.heap.length / this.capacity);
  }

  evict(strategy: EvictStrategy = 'LowestPriority'): void {
    if (this.heap.length === 0) return;
    switch (strategy) {
      case 'LowestPriority':
        this.totalPriority -= this.heap[this.heap.length - 1]!.item.priority;
        this.heap.pop();
        break;
      case 'LRU':
        this.heap.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
        this.totalPriority -= this.heap[this.heap.length - 1]!.item.priority;
        this.heap.pop();
        break;
      case 'Random': {
        const idx = Math.floor(Math.random() * this.heap.length);
        this.totalPriority -= this.heap[idx]!.item.priority;
        this.heap.splice(idx, 1);
        break;
      }
    }
  }

  *all(): IterableIterator<T> {
    for (const entry of this.heap) {
      yield entry.item;
    }
  }

  *entries(): IterableIterator<[T, number]> {
    for (const entry of this.heap) {
      yield [entry.item, entry.item.priority];
    }
  }

  private shouldOverflow(priority: number): boolean {
    if (this.heap.length === 0) return true;
    const minPriority = this.heap[this.heap.length - 1]!.item.priority;
    if (priority <= minPriority) return false;

    this.totalPriority -= minPriority;
    this.heap.pop();
    return true;
  }

  private recalcTotalPriority(): void {
    this.totalPriority = 0;
    for (const entry of this.heap) {
      this.totalPriority += entry.item.priority;
    }
  }

  clear(): void {
    this.heap = [];
    this.totalPriority = 0;
  }

  peek(): T | undefined {
    return this.heap[0]?.item;
  }

  toArray(): T[] {
    return this.heap.map((e) => e.item);
  }
}