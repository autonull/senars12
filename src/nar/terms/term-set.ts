/**
 * Term-based Set wrapper that uses structural equality for membership testing
 */

import type {Term} from './types.js';
import {termsEqual} from './accessors.js';

/**
 * A Set that uses Term objects with proper structural equality
 */
export class TermSet {
    private terms: Term[] = [];

    get size(): number {
        return this.terms.length;
    }

    add(term: Term): this {
        if (!this.has(term)) {
            this.terms.push(term);
        }
        return this;
    }

    has(term: Term): boolean {
        return this.terms.some(t => termsEqual(t, term));
    }

    delete(term: Term): boolean {
        const index = this.terms.findIndex(t => termsEqual(t, term));
        if (index !== -1) {
            this.terms.splice(index, 1);
            return true;
        }
        return false;
    }

    clear(): void {
        this.terms = [];
    }

    * values(): IterableIterator<Term> {
        for (const term of this.terms) {
            yield term;
        }
    }

    * keys(): IterableIterator<Term> {
        for (const term of this.terms) {
            yield term;
        }
    }

    * entries(): IterableIterator<[Term, Term]> {
        for (const term of this.terms) {
            yield [term, term];
        }
    }

    forEach(callbackfn: (value: Term, key: Term, set: TermSet) => void): void {
        for (const term of this.terms) {
            callbackfn(term, term, this);
        }
    }

    toArray(): Term[] {
        return [...this.terms];
    }
}
