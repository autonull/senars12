/**
 * Base class for Term-based collections with structural equality
 *
 * Uses reference equality fast path for terms from TermFactory (which are frozen and cached),
 * with structural equality fallback for other terms.
 */

import type {Term} from './types.js';
import {termsEqual} from './accessors.js';

export abstract class TermCollection<T> {
    protected storage: T[] = [];
    private refIndex = new Map<Term, number>();

    get size(): number {
        return this.storage.length;
    }

    clear(): void {
        this.storage = [];
        this.refIndex.clear();
    }

    protected getIndex(term: Term, getItem: (i: T) => Term): number {
        const refIdx = this.refIndex.get(term);
        if (refIdx !== undefined) return refIdx;
        return this.storage.findIndex(item => termsEqual(getItem(item), term));
    }

    protected setRef(term: Term, index: number): void {
        if (Object.isFrozen(term)) this.refIndex.set(term, index);
    }

    protected clearRef(term: Term): void {
        this.refIndex.delete(term);
    }

    protected reindex(getItem: (i: T) => Term): void {
        for (let i = 0; i < this.storage.length; i++) {
            this.setRef(getItem(this.storage[i]!), i);
        }
    }

    protected deleteItem(term: Term, getItem: (i: T) => Term): boolean {
        const index = this.getIndex(term, getItem);
        if (index >= 0) {
            this.clearRef(term);
            this.storage.splice(index, 1);
            this.reindex(getItem);
            return true;
        }
        return false;
    }
}