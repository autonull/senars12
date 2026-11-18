import type { BagItem, InternalEntry } from './types.js';

/** Largest power of two ≤ `n` (the binary-lifting descent start). */
export function highestBit(n: number): number {
  let mask = 1;
  while (mask * 2 <= n) mask *= 2;
  return mask;
}

/**
 * Fenwick tree (Binary Indexed Tree) for priority-weighted sampling. Sized once
 * to the bag's capacity and mutated in place: the store never exceeds capacity,
 * so the tree never has to grow.
 */
export class FenwickTree<T extends InternalEntry<BagItem>> {
  private readonly tree: number[];

  constructor(capacity: number) {
    this.tree = new Array<number>(capacity + 1).fill(0);
  }

  /** Add `delta` at `index` (0-indexed). */
  add(index: number, delta: number): void {
    for (let i = index + 1; i < this.tree.length; i += i & -i) {
      this.tree[i] = (this.tree[i] ?? 0) + delta;
    }
  }

  /** Find the index whose prefix sum reaches `target`, by binary lifting over the tree. */
  findByPrefixSum(target: number, length: number): number {
    let idx = 0;
    let remaining = target;
    for (let step = highestBit(length); step > 0; step >>= 1) {
      const next = idx + step;
      if (next < length && (this.tree[next] ?? 0) < remaining) {
        idx = next;
        remaining -= this.tree[idx] ?? 0;
      }
    }
    return idx;
  }

  /** Rebuild the entire tree from the current store. */
  rebuild(store: T[]): void {
    const n = store.length;
    this.tree.fill(0);
    for (let i = 0; i < n; i++) this.tree[i + 1] = store[i]!.item.priority;
    for (let i = 1; i <= n; i++) {
      const parent = i + (i & -i);
      if (parent <= n) this.tree[parent]! += this.tree[i]!;
    }
  }
}
