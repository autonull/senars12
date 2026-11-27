/**
 * The capacity- and time-bounded map every bounded container in the repository
 * is a specialisation of: the recency caches, the ledger hot cache, and the
 * associative-memory layers.
 *
 * One `Map` holds the state. Recency is that map's insertion order — `touch`
 * re-inserts, `set` overwrites, and the oldest key is the first — so the
 * recency orderings are O(1) reads of a structure that was already there. A
 * caller-supplied order (`{ by }`) instead scans the live set once per
 * eviction, which is inherent to "lowest score loses" and not an artefact of
 * the container.
 */
import { systemClock } from './clock';
import { minBy } from './collections';
import { occupancy } from './numeric';
import { nextInt } from './random';
export class BoundedMap {
    #entries = new Map();
    maxSize;
    /** Alias for {@link maxSize} to satisfy {@link BoundedContainer}. */
    get capacity() {
        return this.maxSize;
    }
    #ttlMs;
    #neverExpires;
    #now;
    #onEvict;
    #order;
    #touchOnRead;
    #rng;
    constructor(options = {}) {
        const { maxSize = 1000, ttlMs = Infinity, now = systemClock, onEvict, eviction = 'lru', rng, touchOnRead, } = typeof options === 'number' ? { maxSize: options } : options;
        this.maxSize = Math.max(1, maxSize);
        this.#ttlMs = ttlMs;
        this.#neverExpires = ttlMs === Infinity;
        this.#now = now;
        this.#onEvict = onEvict;
        this.#order = eviction;
        this.#touchOnRead = touchOnRead ?? eviction === 'lru';
        this.#rng = rng ?? Math.random;
    }
    size() {
        return this.#entries.size;
    }
    /** Occupancy in `0..1` — the AIKR pressure signal the bounded containers report. */
    pressure() {
        return occupancy(this.size(), this.maxSize);
    }
    evict(key) {
        const entry = this.#entries.get(key);
        if (entry === undefined)
            return false;
        this.#entries.delete(key);
        this.#onEvict?.(entry.value, key);
        return true;
    }
    get(key) {
        const entry = this.#live(key);
        if (entry === undefined)
            return undefined;
        if (this.#touchOnRead)
            this.#reinsert(key, entry);
        return entry.value;
    }
    /** Read without refreshing recency. */
    peek(key) {
        return this.#live(key)?.value;
    }
    /** Refresh recency without a read — the "this was just used" signal. */
    touch(key) {
        const entry = this.#live(key);
        if (entry === undefined)
            return false;
        this.#reinsert(key, entry);
        return true;
    }
    set(key, value) {
        if (this.#entries.has(key))
            this.#entries.delete(key);
        else if (this.#entries.size >= this.maxSize)
            this.#evictVictim();
        this.#entries.set(key, {
            value,
            expiresAt: this.#neverExpires ? Infinity : this.#now() + this.#ttlMs,
        });
        return this;
    }
    /** Remove without firing `onEvict` — the caller already knows what it is releasing. */
    delete(key) {
        return this.#entries.delete(key);
    }
    has(key) {
        return this.#live(key) !== undefined;
    }
    clear() {
        for (const [key, entry] of this.#entries)
            this.#onEvict?.(entry.value, key);
        this.#entries.clear();
    }
    /**
     * Live entries, least-recently-used first, iterated in place: the only mutation
     * an iteration performs is `evict` of the entry it stands on, and a `Map`
     * iterator tolerates deletion of the current key. Snapshotting first allocated
     * an array of the whole map per iteration, on every cache scan and layer sweep.
     */
    *#liveEntries() {
        if (this.#neverExpires) {
            for (const [key, entry] of this.#entries) {
                yield [key, entry.value];
            }
            return;
        }
        const now = this.#now();
        for (const [key, entry] of this.#entries) {
            if (entry.expiresAt <= now)
                this.evict(key);
            else
                yield [key, entry.value];
        }
    }
    /** Live keys, least-recently-used first. */
    *keys() {
        for (const [key] of this.#liveEntries())
            yield key;
    }
    /** Live values, least-recently-used first. */
    *values() {
        for (const [, value] of this.#liveEntries())
            yield value;
    }
    /** Live pairs, least-recently-used first. */
    *entries() {
        yield* this.#liveEntries();
    }
    /** Iteration alias of {@link entries}, so a bounded map is a drop-in for a `Map` read. */
    [Symbol.iterator]() {
        return this.entries();
    }
    toArray() {
        return [...this.values()];
    }
    /** Drop every expired entry. Returns how many were removed. */
    purgeExpired() {
        if (this.#neverExpires)
            return 0;
        let removed = 0;
        for (const [key, entry] of this.#entries) {
            if (this.#expired(entry) && this.evict(key))
                removed++;
        }
        return removed;
    }
    #live(key) {
        const entry = this.#entries.get(key);
        if (entry === undefined)
            return undefined;
        if (this.#expired(entry)) {
            this.evict(key);
            return undefined;
        }
        return entry;
    }
    #expired(entry) {
        return !this.#neverExpires && entry.expiresAt <= this.#now();
    }
    #reinsert(key, entry) {
        this.#entries.delete(key);
        this.#entries.set(key, entry);
    }
    #evictVictim() {
        const victim = this.#selectVictim();
        if (victim !== undefined)
            this.evict(victim);
    }
    #selectVictim() {
        if (this.#order === 'lru' || this.#order === 'fifo') {
            return this.#entries.keys().next().value;
        }
        if (this.#order === 'random')
            return this.#randomKey();
        const { by } = this.#order;
        return minBy(this.#entries, ([, entry]) => by(entry.value))?.[0];
    }
    /** Uniform pick over the live keys, counted rather than copied. */
    #randomKey() {
        const target = nextInt(this.#rng, this.#entries.size);
        let seen = 0;
        for (const key of this.#entries.keys()) {
            if (seen++ === target)
                return key;
        }
        return undefined;
    }
}
