/**
 * Base class for Term-based collections with structural equality
 *
 * Uses reference equality fast path for terms from TermFactory (which are frozen and cached),
 * with structural equality fallback for other terms.
 */

import {termsEqual} from './accessors.js';
import type {Term} from './types.js';

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

        for (let i = 0; i < this.storage.length; i++) {
            const stored = getItem(this.storage[i]!);
            if (stored === term || termsEqual(stored, term)) return i;
        }
        return -1;
    }

    protected setRef(term: Term, index: number): void {
        if (Object.isFrozen(term)) this.refIndex.set(term, index);
    }

    /**
     * Index-based iterator over storage with a projection. Same protocol as a
     * generator method but without the suspend/resume machinery (~5x faster
     * in microbenchmarks for hot iteration paths like values()/keys()).
     */
    protected iterProject<U>(project: (item: T) => U): IterableIterator<U> {
        const storage = this.storage;
        let i = 0;
        const it: IterableIterator<U> = {
            next: (): IteratorResult<U> => {
                if (i >= storage.length) return {value: undefined, done: true};
                return {value: project(storage[i++]!), done: false};
            },
            [Symbol.iterator](): IterableIterator<U> {
                return it;
            },
        };
        return it;
    }

    protected clearRef(term: Term): void {
        this.refIndex.delete(term);
    }

    protected deleteItem(term: Term, getItem: (i: T) => Term): boolean {
        const index = this.getIndex(term, getItem);
        if (index >= 0) {
            this.clearRef(term);
            this.storage.splice(index, 1);
            // shift cached ref indices above the removed slot without a full rebuild
            for (const [key, refIdx] of this.refIndex) {
                if (refIdx > index) this.refIndex.set(key, refIdx - 1);
            }
            return true;
        }
        return false;
    }
}
