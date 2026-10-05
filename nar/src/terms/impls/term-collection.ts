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
import { KeyedCollection } from '@senars/util';

export abstract class TermCollection<T> extends KeyedCollection<Term, T, string> {
  protected deriveKey(key: Term): string {
    return termKey(key);
  }
}
