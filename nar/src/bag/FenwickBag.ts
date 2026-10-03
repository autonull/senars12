import { BaseBag, type BagItem, type BagOptions, type InternalEntry } from './Bag.js';

/** Largest power of two ≤ `n` (the binary-lifting descent start). */
const highestBit = (n: number): number => {
  let mask = 1;
  while (mask * 2 <= n) mask *= 2;
  return mask;
};

/**
 * Fenwick-tree priority bag: weighted sampling in O(log n) over a
 * priority-descending store. The tree is sized to `capacity + 1` once and
 * mutated in place, so structural changes never reallocate it.
 */
export class FenwickBag<T extends BagItem> extends BaseBag<T> {
  private list: InternalEntry<T>[] = [];
  private readonly tree: number[];
  private idToIndex = new Map<string, number>();

  protected get store(): InternalEntry<T>[] {
    return this.list;
  }

  constructor(options: BagOptions) {
    super(options);
    this.tree = new Array<number>(options.capacity + 1).fill(0);
  }

  private addToTree(index: number, value: number): void {
    for (let i = index + 1; i < this.tree.length; i += i & -i) {
      this.tree[i] = this.tree[i]! + value;
    }
  }

  private findByPrefixSum(target: number): number {
    const n = this.store.length;
    let idx = 0;
    let remaining = target;
    for (let step = highestBit(n); step > 0; step >>= 1) {
      const next = idx + step;
      if (next < n && this.tree[next]! < remaining) {
        idx = next;
        remaining -= this.tree[idx]!;
      }
    }
    return idx;
  }

  private rebuildTree(): void {
    this.tree.fill(0);
    const n = this.list.length;
    for (let i = 0; i < n; i++) this.tree[i + 1] = this.list[i]!.item.priority;
    for (let i = 1; i < this.tree.length; i++) {
      const parent = i + (i & -i);
      if (parent < this.tree.length) this.tree[parent] = this.tree[parent]! + this.tree[i]!;
    }
  }

  private updateIdMap(from = 0): void {
    if (from <= 0) this.idToIndex.clear();
    for (let i = Math.max(0, from); i < this.list.length; i++) {
      this.idToIndex.set(this.list[i]!.item.id, i);
    }
  }

  protected insertEntry(entry: InternalEntry<T>): void {
    const idx = this.insertIndex(entry.item.priority);
    this.list.splice(idx, 0, entry);
    // Only a tail insert shifts nothing — then a point update suffices (O(log n)).
    if (idx === this.list.length - 1) this.addToTree(idx, entry.item.priority);
    else this.rebuildTree();
    this.updateIdMap(idx);
  }

  protected eraseAt(index: number): InternalEntry<T> {
    const [removed] = this.list.splice(index, 1);
    this.rebuildTree();
    this.updateIdMap(index);
    return removed!;
  }

  protected dropLast(): void {
    const removed = this.list.pop()!;
    this.addToTree(this.list.length, -removed.item.priority);
    this.updateIdMap();
  }

  protected replaceAll(entries: InternalEntry<T>[]): void {
    this.list = entries;
    this.rebuildTree();
    this.updateIdMap();
  }

  protected indexOf(idOrItem: string | T): number {
    if (typeof idOrItem !== 'string') return this.list.findIndex((e) => e.item === idOrItem);
    const idx = this.idToIndex.get(idOrItem) ?? -1;
    return idx >= 0 && this.list[idx]?.item.id === idOrItem ? idx : -1;
  }

  protected pickWeighted(): InternalEntry<T> | undefined {
    const target = this.rng() * this.totalPriority;
    const idx = this.findByPrefixSum(target);
    return this.list[idx] ?? this.list[0];
  }
}
