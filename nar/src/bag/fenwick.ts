import type { InternalEntry } from './Bag.js';
import type { BagItem } from './Bag.js';

/** Largest power of two ≤ `n` (the binary-lifting descent start). */
export function highestBit(n: number): number {
  let mask = 1;
  while (mask * 2 <= n) mask *= 2;
  return mask;
}

/** Fenwick tree (Binary Indexed Tree) for priority-weighted sampling. */
export class FenwickTree<T extends InternalEntry<BagItem>> {
  private tree: number[];

  constructor(capacity: number) {
    this.tree = new Array<number>(capacity + 1).fill(0);
  }

  /** Get the underlying tree array for direct manipulation. */
  getArray(): number[] {
    return this.tree;
  }

  /** Resize the tree to accommodate a new capacity. */
  resize(newCapacity: number): void {
    if (newCapacity + 1 > this.tree.length) {
      const newTree = new Array<number>(newCapacity + 1).fill(0);
      for (let i = 0; i < this.tree.length; i++) {
        newTree[i] = this.tree[i] ?? 0;
      }
      this.tree = newTree;
    }
  }

  /** Add `delta` at `index` (0-indexed). */
  add(index: number, delta: number): void {
    for (let i = index + 1; i < this.tree.length; i += i & -i) {
      this.tree[i] = (this.tree[i] ?? 0) + delta;
    }
  }

  /** Find the index whose prefix sum reaches `target`. */
  findByPrefixSum(target: number, length: number): number {
    let idx = 0;
    let remaining = target;
    for (let step = highestBit(length); step > 0; step >>= 1) {
      const next = idx + step;
      const nextVal = this.tree[next] ?? 0;
      const idxVal = this.tree[idx] ?? 0;
      if (next < length && nextVal < remaining) {
        idx = next;
        remaining -= idxVal;
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

  /** Get the total sum (prefix sum up to length). */
  total(length: number): number {
    let sum = 0;
    for (let i = length; i > 0; i -= i & -i) {
      sum += this.tree[i] ?? 0;
    }
    return sum;
  }
}