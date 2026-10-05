/**
 * Term-based Map wrapper that uses structural equality for key comparison
 *
 * This replaces Map<number, V> where the number was a term hash,
 * allowing proper Term objects to be used as keys with correct equality semantics.
 *
 * Equality is structural via the canonical `termKey`, so factory-cached and
 * freshly-parsed terms address the same entry.
 */

import type { Term } from '../types.js';
import { TermCollection } from './term-collection.js';

export interface TermMapEntry<V> {
  key: Term;
  value: V;
}

export class TermMap<V> extends TermCollection<TermMapEntry<V>> {
  get(term: Term): V | undefined {
    return this.getEntry(term)?.value;
  }

  set(term: Term, value: V): this {
    const key = this.deriveKey(term);
    // `Map.set` on a present key keeps its position, so re-setting a value does
    // not reorder the collection the way deleting and re-adding it would.
    this.slots.set(key, { key: term, value });
    return this;
  }

  has(term: Term): boolean {
    return this.hasKey(term);
  }

  delete(term: Term): boolean {
    return this.deleteEntry(term);
  }

  getEntries(): TermMapEntry<V>[] {
    return [...this.slots.values()];
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
    for (const entry of this.slots.values()) {
      callbackfn(entry.value, entry.key, this);
    }
  }
}
