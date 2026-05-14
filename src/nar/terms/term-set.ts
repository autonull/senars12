/**
 * Term-based Set wrapper that uses structural equality for membership testing
 *
 * Uses reference equality fast path for terms from TermFactory (which are frozen and cached),
 * with structural equality fallback for other terms.
 */

import type {Term} from './types.js';
import {TermCollection} from './term-collection.js';

export class TermSet extends TermCollection<Term> {
    add(term: Term): this {
        const idx = this.getIndex(term, t => t);
        if (idx < 0) {
            this.storage.push(term);
            this.setRef(term, this.storage.length - 1);
        }
        return this;
    }

    has(term: Term): boolean {
        return this.getIndex(term, t => t) >= 0;
    }

    delete(term: Term): boolean {
        return this.deleteItem(term, t => t);
    }

    * values(): IterableIterator<Term> {
        for (const term of this.storage) {
            yield term;
        }
    }

    * keys(): IterableIterator<Term> {
        return this.values();
    }

    * entries(): IterableIterator<[Term, Term]> {
        for (const term of this.storage) {
            yield [term, term];
        }
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