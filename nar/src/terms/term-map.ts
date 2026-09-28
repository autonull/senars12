/**
 * Term-based Map wrapper that uses structural equality for key comparison
 *
 * This replaces Map<number, V> where the number was a term hash,
 * allowing proper Term objects to be used as keys with correct equality semantics.
 *
 * Equality is structural via the canonical `termKey`, so factory-cached and
 * freshly-parsed terms address the same entry.
 */

import { TermCollection } from './term-collection.js';
import type { Term } from './types.js';

type Entry<V> = { key: Term; value: V };

export class TermMap<V> extends TermCollection<{ key: Term; value: V }> {
  get(term: Term): V | undefined {
    const idx = this.getIndex(term);
    return idx >= 0 ? this.storage[idx]?.value : undefined;
  }

  set(term: Term, value: V): this {
    const existingIndex = this.getIndex(term);
    if (existingIndex >= 0) {
      this.storage[existingIndex]!.value = value;
      return this;
    }
    this.storage.push({ key: term, value });
    this.setRef(term, this.storage.length - 1);
    return this;
  }

  has(term: Term): boolean {
    return this.getIndex(term) >= 0;
  }

  delete(term: Term): boolean {
    return this.deleteItem(term);
  }

  getEntries(): Entry<V>[] {
    return this.storage;
  }

  items(): IterableIterator<[Term, V]> {
    return this.iterProject((e) => [e.key, e.value] as [Term, V]);
  }

  keys(): IterableIterator<Term> {
    return this.iterProject((e) => e.key);
  }

  values(): IterableIterator<V> {
    return this.iterProject((e) => e.value);
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
