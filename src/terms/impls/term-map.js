/**
 * Term-based Map wrapper that uses structural equality for key comparison
 *
 * This replaces Map<number, V> where the number was a term hash,
 * allowing proper Term objects to be used as keys with correct equality semantics.
 *
 * Equality is structural via the canonical `termKey`, so factory-cached and
 * freshly-parsed terms address the same entry.
 */
import { TermCollection } from './term-collection';
export class TermMap extends TermCollection {
    get(term) {
        return this.getEntry(term)?.value;
    }
    set(term, value) {
        const key = this.deriveKey(term);
        // `Map.set` on a present key keeps its position, so re-setting a value does
        // not reorder the collection the way deleting and re-adding it would.
        this.slots.set(key, { key: term, value });
        return this;
    }
    has(term) {
        return this.hasKey(term);
    }
    delete(term) {
        return this.deleteEntry(term);
    }
    getEntries() {
        return [...this.slots.values()];
    }
    *items() {
        for (const entry of this.slots.values())
            yield [entry.key, entry.value];
    }
    *keys() {
        for (const entry of this.slots.values())
            yield entry.key;
    }
    *values() {
        for (const entry of this.slots.values())
            yield entry.value;
    }
    [Symbol.iterator]() {
        return this.items();
    }
    forEach(callbackfn) {
        for (const entry of this.slots.values()) {
            callbackfn(entry.value, entry.key, this);
        }
    }
}
