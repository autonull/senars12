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
    this.slots.set(this.keyOfTerm(term), term);
    return this;
  }

  has(term: Term): boolean {
    return this.slots.has(this.keyOfTerm(term));
  }

  delete(term: Term): boolean {
    return this.slots.delete(this.keyOfTerm(term));
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
    for (const term of this.slots.values()) {
      callbackfn(term, term, this);
    }
  }

  toArray(): Term[] {
    return [...this.slots.values()];
  }
}
