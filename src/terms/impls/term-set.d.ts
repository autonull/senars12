/**
 * Term-based Set wrapper that uses structural equality for membership testing
 *
 * Equality is structural via the canonical `termKey`, so factory-cached and
 * freshly-parsed terms address the same entry.
 */
import { TermCollection } from './term-collection';
import type { Term } from '../types';
export declare class TermSet extends TermCollection<Term> {
    add(term: Term): this;
    has(term: Term): boolean;
    delete(term: Term): boolean;
    values(): Generator<Term>;
    keys(): IterableIterator<Term>;
    entries(): Generator<[Term, Term]>;
    forEach(callbackfn: (value: Term, key: Term, set: TermSet) => void): void;
    toArray(): Term[];
}
//# sourceMappingURL=term-set.d.ts.map