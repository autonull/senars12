/**
 * Term-based Map wrapper that uses structural equality for key comparison
 *
 * This replaces Map<number, V> where the number was a term hash,
 * allowing proper Term objects to be used as keys with correct equality semantics.
 *
 * Uses reference equality fast path for terms from TermFactory (which are frozen and cached),
 * with structural equality fallback for other terms.
 */

import { TermCollection } from './term-collection.js';
import type { Term } from './types.js';

type Entry<V> = { key: Term; value: V };

export class TermMap<V> extends TermCollection<{ key: Term; value: V }> {
  get(term: Term): V | undefined {
    const idx = this.getIndex(term, (e) => e.key);
    return idx >= 0 ? this.storage[idx]?.value : undefined;
  }

  set(term: Term, value: V): this {
    const existingIndex = this.getIndex(term, (e) => e.key);
    if (existingIndex >= 0) {
      this.clearRef(this.storage[existingIndex]!.key);
      this.storage[existingIndex]!.value = value;
      this.setRef(term, existingIndex);
    } else {
      this.storage.push({ key: term, value });
      this.setRef(term, this.storage.length - 1);
    }
    return this;
  }

  has(term: Term): boolean {
    return this.getIndex(term, (e) => e.key) >= 0;
  }

  delete(term: Term): boolean {
    return this.deleteItem(term, (e) => e.key);
  }

  getEntries(): Entry<V>[] {
    return this.storage;
  }

  *items(): IterableIterator<[Term, V]> {
    for (const entry of this.storage) {
      yield [entry.key, entry.value];
    }
  }

  *keys(): IterableIterator<Term> {
    for (const entry of this.storage) {
      yield entry.key;
    }
  }

  *values(): IterableIterator<V> {
    for (const entry of this.storage) {
      yield entry.value;
    }
  }

  [Symbol.iterator](): IterableIterator<[Term, V]> {
    return this.items();
  }

  forEach(callbackfn: (value: V, key: Term, map: TermMap<V>) => void): void {
    for (const entry of this.storage) {
      callbackfn(entry.value, entry.key, this);
    }
  }
}
