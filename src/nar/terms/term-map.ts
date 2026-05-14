/**
 * Term-based Map wrapper that uses structural equality for key comparison
 *
 * This replaces Map<number, V> where the number was a term hash,
 * allowing proper Term objects to be used as keys with correct equality semantics.
 *
 * Uses reference equality fast path for terms from TermFactory (which are frozen and cached),
 * with structural equality fallback for other terms.
 */

import type {Term} from './types.js';
import {termsEqual} from './accessors.js';

/**
 * A Map that uses Term objects as keys with proper structural equality
 */
export class TermMap<V> {
    private entries: Array<{ key: Term; value: V }> = [];
    private refIndex = new Map<Term, number>();

    get size(): number {
        return this.entries.length;
    }

    private getIndex(term: Term): number {
        const refIdx = this.refIndex.get(term);
        if (refIdx !== undefined) return refIdx;
        return this.entries.findIndex(e => termsEqual(e.key, term));
    }

    private setRef(term: Term, index: number): void {
        if (Object.isFrozen(term)) this.refIndex.set(term, index);
    }

    private clearRef(term: Term): void {
        this.refIndex.delete(term);
    }

    get(term: Term): V | undefined {
        const idx = this.getIndex(term);
        return idx >= 0 ? this.entries[idx]?.value : undefined;
    }

    set(term: Term, value: V): this {
        const existingIndex = this.getIndex(term);
        if (existingIndex >= 0) {
            this.clearRef(this.entries[existingIndex]!.key);
            this.entries[existingIndex]!.value = value;
            this.setRef(term, existingIndex);
        } else {
            this.entries.push({key: term, value});
            this.setRef(term, this.entries.length - 1);
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
            this.entries.splice(index, 1);
            for (let i = index; i < this.entries.length; i++) {
                this.setRef(this.entries[i]!.key, i);
            }
            return true;
        }
        return false;
    }

    clear(): void {
        this.entries = [];
        this.refIndex.clear();
    }

    getEntries(): Array<{ key: Term; value: V }> {
        return this.entries;
    }

    * items(): IterableIterator<[Term, V]> {
        for (const entry of this.entries) {
            yield [entry.key, entry.value];
        }
    }

    * keys(): IterableIterator<Term> {
        for (const entry of this.entries) {
            yield entry.key;
        }
    }

    * values(): IterableIterator<V> {
        for (const entry of this.entries) {
            yield entry.value;
        }
    }

    [Symbol.iterator](): IterableIterator<[Term, V]> {
        return this.items();
    }

    forEach(callbackfn: (value: V, key: Term, map: TermMap<V>) => void): void {
        for (const entry of this.entries) {
            callbackfn(entry.value, entry.key, this);
        }
    }
}
