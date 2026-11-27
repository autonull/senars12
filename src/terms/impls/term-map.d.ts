/**
 * Term-based Map wrapper that uses structural equality for key comparison
 *
 * This replaces Map<number, V> where the number was a term hash,
 * allowing proper Term objects to be used as keys with correct equality semantics.
 *
 * Equality is structural via the canonical `termKey`, so factory-cached and
 * freshly-parsed terms address the same entry.
 */
import type { Term } from '../types';
import { TermCollection } from './term-collection';
export interface TermMapEntry<V> {
    key: Term;
    value: V;
}
export declare class TermMap<V> extends TermCollection<TermMapEntry<V>> {
    get(term: Term): V | undefined;
    set(term: Term, value: V): this;
    has(term: Term): boolean;
    delete(term: Term): boolean;
    getEntries(): TermMapEntry<V>[];
    items(): Generator<[Term, V]>;
    keys(): Generator<Term>;
    values(): Generator<V>;
    [Symbol.iterator](): IterableIterator<[Term, V]>;
    forEach(callbackfn: (value: V, key: Term, map: TermMap<V>) => void): void;
}
//# sourceMappingURL=term-map.d.ts.map