/**
 * AIKR Bag — the unified priority bag substrate.
 *
 * This is the single bag implementation used by every layer:
 * the NAR's attention bags, the focus bags, the drive bags,
 * the learning bags, the proposal bags, and the mining bags.
 * One substrate, one policy, one import.
 */
import { SenarsError } from '../errors/senars-error';
import { createLogger } from './logger';
const logger = createLogger({ scope: 'util:bag' });
import { ambientRng } from './random';
/** Bounded priority bag — the one implementation. */
export class PriorityBag {
    id;
    capacity;
    #evictStrategy;
    #clock;
    #rng;
    #decayRate;
    #forgetRate;
    #onPressure;
    #items = new Map();
    #pressure = 'normal';
    #version = 0;
    #sortedCache = null;
    #sortedDirty = true;
    // Cached prefix sums for fast weighted sampling
    #sampleCacheVersion = 0;
    #prefixSums = null;
    #prefixSumItems = null;
    // Incremental tracking for O(1) eviction
    #minPriorityEntry = null;
    // O(1) peek cache - tracks the max priority entry
    #peekCache = null;
    #oldestEntry = null;
    #lruEntry = null;
    #invalidateCache() {
        this.#sortedDirty = true;
        this.#sortedCache = null;
        this.#peekCache = null;
        this.#sampleCacheVersion = 0;
        this.#prefixSums = null;
        this.#prefixSumItems = null;
    }
    #ensureSorted() {
        if (this.#sortedDirty) {
            this.#sortedCache = Array.from(this.#items.values())
                .sort((a, b) => b._currentPriority - a._currentPriority)
                .map((entry) => entry._item);
            this.#sortedDirty = false;
        }
        return this.#sortedCache;
    }
    #updateMinPriority(entry, isNew = false) {
        if (this.#minPriorityEntry === null || entry._currentPriority < this.#minPriorityEntry._currentPriority) {
            this.#minPriorityEntry = entry;
        }
        else if (!isNew && this.#minPriorityEntry._currentPriority !== entry._currentPriority) {
            // The min was updated, may need to rescan if this was the min
            if (this.#minPriorityEntry === entry) {
                this.#recomputeMinPriority();
            }
        }
    }
    #recomputeMinPriority() {
        let min = null;
        for (const entry of this.#items.values()) {
            if (min === null || entry._currentPriority < min._currentPriority) {
                min = entry;
            }
        }
        this.#minPriorityEntry = min;
    }
    #updateOldest(entry, isNew = false) {
        if (this.#oldestEntry === null || entry._insertedAt < this.#oldestEntry._insertedAt) {
            this.#oldestEntry = entry;
        }
        else if (!isNew && this.#oldestEntry._insertedAt !== entry._insertedAt) {
            if (this.#oldestEntry === entry) {
                this.#recomputeOldest();
            }
        }
    }
    #recomputeOldest() {
        let oldest = null;
        for (const entry of this.#items.values()) {
            if (oldest === null || entry._insertedAt < oldest._insertedAt) {
                oldest = entry;
            }
        }
        this.#oldestEntry = oldest;
    }
    #updateLRU(entry, isNew = false) {
        if (this.#lruEntry === null || entry._lastAccessedAt < this.#lruEntry._lastAccessedAt) {
            this.#lruEntry = entry;
        }
        else if (!isNew && this.#lruEntry._lastAccessedAt !== entry._lastAccessedAt) {
            if (this.#lruEntry === entry) {
                this.#recomputeLRU();
            }
        }
    }
    #recomputeLRU() {
        let lru = null;
        for (const entry of this.#items.values()) {
            if (lru === null || entry._lastAccessedAt < lru._lastAccessedAt) {
                lru = entry;
            }
        }
        this.#lruEntry = lru;
    }
    #removeTracking(entry) {
        if (this.#minPriorityEntry === entry)
            this.#recomputeMinPriority();
        if (this.#oldestEntry === entry)
            this.#recomputeOldest();
        if (this.#lruEntry === entry)
            this.#recomputeLRU();
    }
    #updateTrackingOnAdd(entry) {
        this.#updateMinPriority(entry, true);
        this.#updateOldest(entry, true);
        this.#updateLRU(entry, true);
        this.#updatePeekCache(entry);
    }
    #updateTrackingOnUpdate(entry) {
        this.#updateMinPriority(entry);
        this.#updateOldest(entry);
        this.#updateLRU(entry);
        this.#updatePeekCache(entry);
    }
    #updatePeekCache(entry) {
        if (this.#peekCache === null || entry._currentPriority > this.#peekCache._currentPriority) {
            this.#peekCache = entry;
        }
    }
    constructor(options) {
        if (!options.capacity || options.capacity <= 0) {
            throw new SenarsError('Bag capacity must be a positive number', 'VALIDATION_ERROR', { capacity: options.capacity });
        }
        this.id = options.id ?? `bag-${Date.now()}-${ambientRng().toString(36).slice(2, 8)}`;
        this.capacity = options.capacity;
        this.#evictStrategy = options.evictStrategy ?? 'priority';
        this.#clock = options.clock ?? (() => Date.now());
        this.#rng = options.rng ?? ambientRng;
        this.#decayRate = options.decayRate ?? 0;
        this.#forgetRate = options.forgetRate ?? 0;
        this.#onPressure = options.onPressure;
    }
    get size() {
        return this.#items.size;
    }
    pressure() {
        return this.#pressure;
    }
    get version() {
        return this.#version;
    }
    get decayRateValue() {
        return this.#decayRate;
    }
    set decayRateValue(value) {
        this.#decayRate = value;
    }
    get forgetRateValue() {
        return this.#forgetRate || undefined;
    }
    set forgetRateValue(value) {
        this.#forgetRate = value ?? 0;
    }
    add(item) {
        const now = this.#clock();
        const entry = {
            ...item,
            _insertedAt: now,
            _lastAccessedAt: now,
            _accessCount: 0,
            _currentPriority: item.priority,
            _item: item,
        };
        // Evict if at capacity
        if (this.#items.size >= this.capacity) {
            // For 'priority' strategy, only admit if new item beats the lowest (strictly)
            if (this.#evictStrategy === 'priority') {
                if (this.#minPriorityEntry !== null && item.priority < this.#minPriorityEntry._currentPriority) {
                    return false;
                }
            }
            const evicted = this.#evict();
            if (!evicted)
                return false;
        }
        this.#items.set(item.id, entry);
        this.#updateTrackingOnAdd(entry);
        this.#version++;
        this.#invalidateCache();
        this.#updatePressure();
        return true;
    }
    remove(id) {
        const entry = this.#items.get(id);
        const result = this.#items.delete(id);
        if (result) {
            if (entry) {
                this.#removeTracking(entry);
                if (this.#peekCache === entry) {
                    this.#peekCache = null;
                }
            }
            this.#version++;
            this.#invalidateCache();
            this.#updatePressure();
        }
        return result;
    }
    removeAll(predicate) {
        let count = 0;
        let peekInvalidated = false;
        for (const [id, entry] of this.#items) {
            if (predicate(entry._item)) {
                this.#items.delete(id);
                this.#removeTracking(entry);
                if (this.#peekCache === entry) {
                    peekInvalidated = true;
                }
                count++;
            }
        }
        if (count > 0) {
            if (peekInvalidated)
                this.#peekCache = null;
            this.#version++;
            this.#invalidateCache();
            this.#updatePressure();
        }
        return count;
    }
    removeMany(predicate) {
        return this.removeAll(predicate);
    }
    get(id) {
        const entry = this.#items.get(id);
        if (entry) {
            // Update access metadata in place to avoid allocation
            const now = this.#clock();
            entry._lastAccessedAt = now;
            entry._accessCount = entry._accessCount + 1;
            this.#updateLRU(entry);
            return entry._item;
        }
        return undefined;
    }
    all() {
        return this.#ensureSorted();
    }
    values() {
        const entries = this.#items.values();
        return {
            [Symbol.iterator]() {
                return this;
            },
            next() {
                const result = entries.next();
                return result.done
                    ? { done: true, value: undefined }
                    : { done: false, value: result.value._item };
            },
        };
    }
    updatePriority(id, priority) {
        const entry = this.#items.get(id);
        if (!entry)
            return false;
        entry._currentPriority = priority;
        entry.priority = priority;
        this.#updateTrackingOnUpdate(entry);
        this.#version++;
        this.#sortedDirty = true;
        this.#sortedCache = null;
        return true;
    }
    setEvictStrategy(strategy) {
        if (!['priority', 'fifo', 'lru', 'random'].includes(strategy)) {
            throw new SenarsError(`Invalid evict strategy: ${strategy}`, 'VALIDATION_ERROR', { strategy });
        }
        logger.warn(`Evict strategy change to ${strategy} not fully supported on live bag`);
    }
    decay() {
        if (this.#decayRate <= 0 && this.#forgetRate <= 0)
            return;
        const now = this.#clock();
        let hasChanges = false;
        let newPeekEntry = null;
        let newMinEntry = null;
        for (const [id, entry] of this.#items) {
            const ageSeconds = (now - entry._insertedAt) / 1000;
            const decay = this.#decayRate * ageSeconds;
            const forget = this.#forgetRate * ageSeconds;
            const originalPriority = entry._item.priority;
            const newPriority = Math.max(0, originalPriority - decay - forget);
            if (newPriority <= 0) {
                this.#items.delete(id);
                this.#removeTracking(entry);
                hasChanges = true;
            }
            else if (newPriority !== entry._currentPriority) {
                entry._currentPriority = newPriority;
                entry.priority = newPriority;
                if (newPeekEntry === null || newPriority > newPeekEntry._currentPriority) {
                    newPeekEntry = entry;
                }
                if (newMinEntry === null || newPriority < newMinEntry._currentPriority) {
                    newMinEntry = entry;
                }
                hasChanges = true;
            }
            else if (newPeekEntry === null || newPriority > newPeekEntry._currentPriority) {
                newPeekEntry = entry;
            }
            if (newMinEntry === null || newPriority < newMinEntry._currentPriority) {
                newMinEntry = entry;
            }
        }
        if (hasChanges) {
            this.#peekCache = newPeekEntry;
            this.#minPriorityEntry = newMinEntry;
            this.#version++;
            this.#invalidateCache();
            this.#updatePressure();
        }
        else if (newPeekEntry !== null) {
            this.#peekCache = newPeekEntry;
            this.#minPriorityEntry = newMinEntry;
        }
    }
    sample(count) {
        const items = this.#ensureSorted();
        if (items.length <= count)
            return items;
        // Build or reuse prefix sums for O(log n) per draw
        if (this.#sampleCacheVersion !== this.#version || this.#prefixSums === null) {
            const validItems = [];
            const prefixSums = [];
            let sum = 0;
            for (const item of items) {
                const p = item.priority;
                if (p > 0) {
                    validItems.push(item);
                    sum += p;
                    prefixSums.push(sum);
                }
            }
            this.#prefixSumItems = validItems;
            this.#prefixSums = prefixSums;
            this.#sampleCacheVersion = this.#version;
        }
        const validItems = this.#prefixSumItems;
        const prefixSums = this.#prefixSums;
        if (validItems.length === 0)
            return [];
        // Binary search sampling without replacement
        const n = validItems.length;
        const picked = [];
        const drawn = new Uint8Array(n); // 0 = available, 1 = drawn
        const total = prefixSums[n - 1];
        for (let draw = 0; draw < count && draw < n; draw++) {
            const roll = this.#rng() * total;
            // Binary search for the index
            let lo = 0;
            let hi = n - 1;
            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                if (prefixSums[mid] < roll)
                    lo = mid + 1;
                else
                    hi = mid;
            }
            let idx = lo;
            // Find next available (not drawn) item
            while (idx < n && drawn[idx])
                idx++;
            if (idx >= n)
                break; // No more available items
            drawn[idx] = 1;
            picked.push(validItems[idx]);
        }
        return picked;
    }
    /** Get all items as array (alias for all()). */
    toArray() {
        return this.all();
    }
    /** Iterate entries as [item, priority] pairs. */
    entries() {
        const entries = this.#items.entries();
        return {
            [Symbol.iterator]() {
                return this;
            },
            next() {
                const result = entries.next();
                return result.done
                    ? { done: true, value: undefined }
                    : { done: false, value: [result.value[1]._item, result.value[1]._currentPriority] };
            },
        };
    }
    /** Get the highest-priority item without removing it. */
    peek() {
        if (this.#items.size === 0)
            return undefined;
        if (this.#peekCache !== null) {
            return this.#peekCache._item;
        }
        if (!this.#sortedDirty && this.#sortedCache && this.#sortedCache.length > 0) {
            return this.#sortedCache[0];
        }
        let bestEntry = null;
        let bestPriority = -Infinity;
        for (const entry of this.#items.values()) {
            if (entry._currentPriority > bestPriority) {
                bestPriority = entry._currentPriority;
                bestEntry = entry;
            }
        }
        this.#peekCache = bestEntry;
        return bestEntry?._item;
    }
    /** Find first item matching predicate. */
    find(predicate) {
        for (const entry of this.#items.values()) {
            if (predicate(entry._item)) {
                return entry._item;
            }
        }
        return undefined;
    }
    onPressure(listener) {
        const existing = this.#onPressure;
        this.#onPressure = (t) => {
            existing?.(t);
            listener(t);
        };
        return () => {
            if (this.#onPressure === listener) {
                this.#onPressure = undefined;
            }
            else if (this.#onPressure) {
                // Can't easily remove chained listener without more infrastructure
            }
        };
    }
    clear() {
        this.#items.clear();
        this.#minPriorityEntry = null;
        this.#oldestEntry = null;
        this.#lruEntry = null;
        this.#peekCache = null;
        this.#version++;
        this.#invalidateCache();
        this.#updatePressure();
    }
    /** Evict one item using the given strategy (or current strategy if not provided). */
    evict(strategy) {
        const originalStrategy = this.#evictStrategy;
        if (strategy) {
            this.#evictStrategy = strategy;
        }
        const result = this.#evict();
        if (strategy) {
            this.#evictStrategy = originalStrategy;
        }
        return result;
    }
    #evict() {
        if (this.#items.size === 0)
            return false;
        let victimId = null;
        switch (this.#evictStrategy) {
            case 'priority': {
                if (this.#minPriorityEntry !== null) {
                    victimId = this.#minPriorityEntry.id;
                }
                break;
            }
            case 'fifo': {
                if (this.#oldestEntry !== null) {
                    victimId = this.#oldestEntry.id;
                }
                break;
            }
            case 'lru': {
                if (this.#lruEntry !== null) {
                    victimId = this.#lruEntry.id;
                }
                break;
            }
            case 'random': {
                const entries = Array.from(this.#items.keys());
                victimId = entries[Math.floor(this.#rng() * entries.length)];
                break;
            }
        }
        if (victimId) {
            const entry = this.#items.get(victimId);
            this.#items.delete(victimId);
            if (entry) {
                this.#removeTracking(entry);
                if (this.#peekCache === entry) {
                    this.#peekCache = null;
                }
            }
            this.#version++;
            this.#invalidateCache();
            return true;
        }
        return false;
    }
    #updatePressure() {
        const utilization = this.#items.size / this.capacity;
        const newPressure = utilization >= 0.95 ? 'critical' : utilization >= 0.75 ? 'elevated' : 'normal';
        if (newPressure !== this.#pressure) {
            const transition = {
                bagId: this.id,
                pressure: newPressure,
                capacity: this.capacity,
                size: this.#items.size,
                transition: `${this.#pressure}->${newPressure}`,
            };
            this.#pressure = newPressure;
            this.#onPressure?.(transition);
        }
    }
}
