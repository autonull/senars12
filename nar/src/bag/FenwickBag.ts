import { BaseBag, type BagItem, type BagOptions, type InternalEntry } from './Bag.js';
import { FenwickTree } from './fenwick.js';

/**
 * Fenwick-tree priority bag: weighted sampling in O(log n) over a
 * priority-descending store. The tree is sized to `capacity + 1` once and
 * mutated in place, so structural changes never reallocate it.
 */
export class FenwickBag<T extends BagItem> extends BaseBag<T> {
  private list: InternalEntry<T>[] = [];
  private readonly fenwick: FenwickTree<InternalEntry<T>>;
  private idToIndex = new Map<string, number>();

  protected get store(): InternalEntry<T>[] {
    return this.list;
  }

  constructor(options: BagOptions) {
    super(options);
    this.fenwick = new FenwickTree<InternalEntry<T>>(options.capacity);
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
    if (idx === this.list.length - 1) this.fenwick.add(idx, entry.item.priority);
    else this.fenwick.rebuild(this.list);
    this.updateIdMap(idx);
  }

  protected eraseAt(index: number): InternalEntry<T> {
    const [removed] = this.list.splice(index, 1);
    this.fenwick.rebuild(this.list);
    this.updateIdMap(index);
    return removed!;
  }

  protected dropLast(): void {
    const removed = this.list.pop()!;
    this.fenwick.add(this.list.length, -removed.item.priority);
    this.updateIdMap();
  }

  protected replaceAll(entries: InternalEntry<T>[]): void {
    this.list = entries;
    this.fenwick.rebuild(this.list);
    this.updateIdMap();
  }

  protected indexOf(idOrItem: string | T): number {
    if (typeof idOrItem !== 'string') return this.list.findIndex((e) => e.item === idOrItem);
    const idx = this.idToIndex.get(idOrItem) ?? -1;
    return idx >= 0 && this.list[idx]?.item.id === idOrItem ? idx : -1;
  }

  protected pickWeighted(): InternalEntry<T> | undefined {
    const target = this.rng() * this.totalPriority;
    const idx = this.fenwick.findByPrefixSum(target, this.list.length);
    return this.list[idx] ?? this.list[0];
  }
}
