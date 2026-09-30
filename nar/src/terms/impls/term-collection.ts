/**
 * Base class for Term-keyed collections with structural equality.
 *
 * Lookups go through `termKey`, the canonical structural identity, so
 * non-frozen (non-canonical) terms cost O(1) instead of a deep-equality scan
 * over the whole collection.
 */

import { termKey } from './accessors.js';
import type { Term } from '../types.js';

export abstract class TermCollection<T> {
  protected storage: T[] = [];
  private keyIndex = new Map<string, number>();

  get size(): number {
    return this.storage.length;
  }

  clear(): void {
    this.storage = [];
    this.keyIndex.clear();
  }

  protected getIndex(term: Term): number {
    return this.keyIndex.get(termKey(term)) ?? -1;
  }

  protected setRef(term: Term, index: number): void {
    this.keyIndex.set(termKey(term), index);
  }

  /**
   * Index-based iterator over storage with a projection. Same protocol as a
   * generator method but without the suspend/resume machinery (~5x faster
   * in microbenchmarks for hot iteration paths like values()/keys()).
   */
  protected iterProject<U>(project: (item: T) => U): IterableIterator<U> {
    const storage = this.storage;
    let i = 0;
    const it: IterableIterator<U> = {
      next: (): IteratorResult<U> => {
        if (i >= storage.length) return { value: undefined, done: true };
        return { value: project(storage[i++]!), done: false };
      },
      [Symbol.iterator](): IterableIterator<U> {
        return it;
      },
    };
    return it;
  }

  protected clearRef(term: Term): void {
    this.keyIndex.delete(termKey(term));
  }

  protected deleteItem(term: Term): boolean {
    const index = this.getIndex(term);
    if (index < 0) return false;
    this.clearRef(term);
    this.storage.splice(index, 1);
    // shift cached key indices above the removed slot without a full rebuild
    for (const [key, idx] of this.keyIndex) {
      if (idx > index) this.keyIndex.set(key, idx - 1);
    }
    return true;
  }
}
