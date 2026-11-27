/**
 * Bounded cache with hit/miss accounting — the recency specialisation of
 * {@link BoundedMap}, and what the term, translation, and LM-response caches
 * use. Everything except the counters is inherited; a caller that needs an
 * eviction order other than recency wants `BoundedMap` directly.
 */
import { BoundedMap } from './bounded-map';
import { safeRatio } from './numeric';
export class LruCache extends BoundedMap {
    #hits = 0;
    #misses = 0;
    constructor(options = {}) {
        super(options);
    }
    get hits() {
        return this.#hits;
    }
    get misses() {
        return this.#misses;
    }
    get hitRate() {
        return safeRatio(this.#hits, this.#hits + this.#misses);
    }
    get(key) {
        const value = super.get(key);
        if (value === undefined)
            this.#misses++;
        else
            this.#hits++;
        return value;
    }
    /**
     * Read an entry and remove it in one step — read-once semantics, so a
     * concurrent second reader sees the miss rather than the same value. Returns
     * `undefined` for absent and expired keys, exactly as {@link get}.
     */
    take(key) {
        const value = this.get(key);
        if (value !== undefined)
            this.delete(key);
        return value;
    }
    clear() {
        super.clear();
        this.#hits = 0;
        this.#misses = 0;
    }
}
