/**
 * Base class for Term-keyed collections with structural equality.
 *
 * One `Map` keyed by `termKey` — the canonical structural identity — holds both
 * membership and iteration order. It was a parallel array plus a
 * `Map<string, index>` side index, which meant a delete had to shift every
 * index above the hole: O(live keys) each, so the consolidation pass that
 * removes a fifth of the concept store was quadratic in the store it was
 * bounding. `Map` already iterates in insertion order, so the array was a
 * hand-rolled copy of what the structure gives away, and the index was a
 * second thing to keep in step.
 *
 * Non-frozen (non-canonical) terms therefore cost O(1) to look up rather than a
 * deep-equality scan over the whole collection.
 */

import type { Term } from '../types.js';
import { termKey } from './accessors.js';

export abstract class TermCollection<T> {
  protected readonly slots = new Map<string, T>();

  get size(): number {
    return this.slots.size;
  }

  clear(): void {
    this.slots.clear();
  }

  /** The canonical key an item is stored under. */
  protected abstract keyOf(item: T): string;

  protected keyOfTerm(term: Term): string {
    return termKey(term);
  }

  /**
   * Index-free iterator over the values with a projection. Same protocol as a
   * generator method but without the suspend/resume machinery (~5x faster
   * in microbenchmarks for hot iteration paths like values()/keys()).
   */
  protected iterProject<U>(project: (item: T) => U): IterableIterator<U> {
    const values = this.slots.values();
    let i = 0;
    const it: IterableIterator<U> = {
      next: (): IteratorResult<U> => {
        const step = values.next();
        return step.done
          ? { value: undefined, done: true }
          : { value: project(step.value), done: false };
      },
      [Symbol.iterator](): IterableIterator<U> {
        return it;
      },
    };
    return it;
  }
}
