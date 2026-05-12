/**
 * Term-based Map wrapper that uses structural equality for key comparison
 * 
 * This replaces Map<number, V> where the number was a term hash,
 * allowing proper Term objects to be used as keys with correct equality semantics.
 */

import type {Term} from './types.js';
import {termsEqual} from './accessors.js';

/**
 * A Map that uses Term objects as keys with proper structural equality
 */
export class TermMap<V> {
  private entries: Array<{key: Term; value: V}> = [];

  get size(): number {
    return this.entries.length;
  }

  get(term: Term): V | undefined {
    const entry = this.entries.find(e => termsEqual(e.key, term));
    return entry?.value;
  }

  set(term: Term, value: V): this {
    const existingIndex = this.entries.findIndex(e => termsEqual(e.key, term));
    if (existingIndex !== -1) {
      this.entries[existingIndex]!.value = value;
    } else {
      this.entries.push({key: term, value});
    }
    return this;
  }

  has(term: Term): boolean {
    return this.entries.some(e => termsEqual(e.key, term));
  }

  delete(term: Term): boolean {
    const index = this.entries.findIndex(e => termsEqual(e.key, term));
    if (index !== -1) {
      this.entries.splice(index, 1);
      return true;
    }
    return false;
  }

  clear(): void {
    this.entries = [];
  }

  getEntries(): Array<{key: Term; value: V}> {
    return this.entries;
  }

  *items(): IterableIterator<[Term, V]> {
    for (const entry of this.entries) {
      yield [entry.key, entry.value];
    }
  }

  *keys(): IterableIterator<Term> {
    for (const entry of this.entries) {
      yield entry.key;
    }
  }

  *values(): IterableIterator<V> {
    for (const entry of this.entries) {
      yield entry.value;
    }
  }

  [Symbol.iterator](): IterableIterator<[Term, V]> {
    return this.items();
  }

  forEach(callbackfn: (value: V, key: Term, map: TermMap<V>) => void): void {
    for (const entry of this.entries) {
      callbackfn(entry.value, entry.key, this);
    }
  }
}
