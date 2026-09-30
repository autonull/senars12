/**
 * Term-based Set wrapper that uses structural equality for membership testing
 *
 * Equality is structural via the canonical `termKey`, so factory-cached and
 * freshly-parsed terms address the same entry.
 */

import { TermCollection } from './term-collection.js';
import type { Term } from '../types.js';

export class TermSet extends TermCollection<Term> {
  add(term: Term): this {
    const idx = this.getIndex(term);
    if (idx < 0) {
      this.storage.push(term);
      this.setRef(term, this.storage.length - 1);
    }
    return this;
  }

  has(term: Term): boolean {
    return this.getIndex(term) >= 0;
  }

  delete(term: Term): boolean {
    return this.deleteItem(term);
  }

  values(): IterableIterator<Term> {
    return this.iterProject((t) => t);
  }

  keys(): IterableIterator<Term> {
    return this.values();
  }

  entries(): IterableIterator<[Term, Term]> {
    return this.iterProject((t) => [t, t] as [Term, Term]);
  }

  forEach(callbackfn: (value: Term, key: Term, set: TermSet) => void): void {
    for (const term of this.storage) {
      callbackfn(term, term, this);
    }
  }

  toArray(): Term[] {
    return [...this.storage];
  }
}
