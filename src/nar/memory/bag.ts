export interface BagItem<T> {
  readonly item: T;
  readonly priority: number;
  readonly addedAt: number;
}

export class Bag<T> {
  private items: BagItem<T>[] = [];
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  add(item: T, priority: number): boolean {
    if (this.items.length >= this.maxSize) {
      let minP = Infinity;
      for (const { priority: p } of this.items) if (p < minP) minP = p;
      if (priority <= minP) return false;
      const minIdx = this.items.findIndex(i => i.priority === minP);
      this.items.splice(minIdx, 1);
    }
    const idx = this.items.findIndex(i => i.priority < priority);
    idx === -1
      ? this.items.push({ item, priority, addedAt: Date.now() })
      : this.items.splice(idx, 0, { item, priority, addedAt: Date.now() });
    return true;
  }

  remove(item: T): boolean {
    const idx = this.items.findIndex(i => i.item === item);
    if (idx >= 0) { this.items.splice(idx, 1); return true; }
    return false;
  }

  peek(): T | undefined {
    return this.items[0]?.item;
  }

  get size(): number {
    return this.items.length;
  }

  pruneTo(maxSize: number): void {
    this.items = this.items.slice(0, maxSize);
  }

  *entries(): Generator<[T, number]> {
    for (const { item, priority } of this.items) {
      yield [item, priority];
    }
  }
}