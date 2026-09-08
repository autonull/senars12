export interface BagItem {
  id: string;
  priority: number;
}

export interface BagOptions {
  capacity: number;
  decayRate?: number;
  forgetRate?: number;
}

export interface Bag<T extends BagItem> {
  readonly capacity: number;
  add(item: T): void;
  sample(): T | undefined;
  remove(id: string): void;
  decay(): void;
  size(): number;
  all(): IterableIterator<T>;
}

interface InternalEntry<T extends BagItem> {
  item: T;
  createdAt: number;
  lastAccessedAt: number;
}

export class PriorityBag<T extends BagItem> implements Bag<T> {
  readonly capacity: number;
  private readonly decayRate: number;
  private readonly forgetRate: number;
  private heap: InternalEntry<T>[] = [];
  private totalPriority = 0;

  constructor(options: BagOptions) {
    this.capacity = options.capacity;
    this.decayRate = options.decayRate ?? 0.01;
    this.forgetRate = options.forgetRate ?? 0.001;
  }

  add(item: T): void {
    if (this.capacity === 0) return;

    const now = Date.now();
    const entry: InternalEntry<T> = {
      item,
      createdAt: now,
      lastAccessedAt: now,
    };

    if (this.heap.length >= this.capacity) {
      if (!this.shouldOverflow(item.priority)) return;
    }

    const idx = this.heap.findIndex((e) => e.item.priority < item.priority);
    if (idx === -1) {
      this.heap.push(entry);
    } else {
      this.heap.splice(idx, 0, entry);
    }
    this.totalPriority += item.priority;
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

  remove(id: string): void {
    const idx = this.heap.findIndex((e) => e.item.id === id);
    if (idx >= 0) {
      this.totalPriority -= this.heap[idx]!.item.priority;
      this.heap.splice(idx, 1);
    }
  }

  decay(): void {
    const now = Date.now();
    let newTotal = 0;

    for (const entry of this.heap) {
      entry.item.priority *= 1 - this.decayRate;
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

  *all(): IterableIterator<T> {
    for (const entry of this.heap) {
      yield entry.item;
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