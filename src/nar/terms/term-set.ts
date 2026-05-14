/**
 * Term-based Set wrapper that uses structural equality for membership testing
 *
 * Uses reference equality fast path for terms from TermFactory (which are frozen and cached),
 * with structural equality fallback for other terms.
 */

import type {Term} from './types.js';
import {termsEqual} from './accessors.js';

/**
 * A Set that uses Term objects with proper structural equality
 */
export class TermSet {
    private terms: Term[] = [];
    private refIndex = new Map<Term, number>();

    get size(): number {
        return this.terms.length;
    }

    private getIndex(term: Term): number {
        const refIdx = this.refIndex.get(term);
        if (refIdx !== undefined) return refIdx;
        return this.terms.findIndex(t => termsEqual(t, term));
    }

    private setRef(term: Term, index: number): void {
        if (Object.isFrozen(term)) this.refIndex.set(term, index);
    }

    private clearRef(term: Term): void {
        this.refIndex.delete(term);
    }

    add(term: Term): this {
        const idx = this.getIndex(term);
        if (idx < 0) {
            this.terms.push(term);
            this.setRef(term, this.terms.length - 1);
        }
        return this;
    }

    has(term: Term): boolean {
        return this.getIndex(term) >= 0;
    }

    delete(term: Term): boolean {
        const index = this.getIndex(term);
        if (index >= 0) {
            this.clearRef(term);
            this.terms.splice(index, 1);
            for (let i = index; i < this.terms.length; i++) {
                this.setRef(this.terms[i]!, i);
            }
            return true;
        }
        return false;
    }

    clear(): void {
        this.terms = [];
        this.refIndex.clear();
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
