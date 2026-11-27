/**
 * Term-based Set wrapper that uses structural equality for membership testing
 *
 * Equality is structural via the canonical `termKey`, so factory-cached and
 * freshly-parsed terms address the same entry.
 */
import { TermCollection } from './term-collection';
export class TermSet extends TermCollection {
    add(term) {
        this.setEntry(term, term);
        return this;
    }
    has(term) {
        return this.hasKey(term);
    }
    delete(term) {
        return this.deleteEntry(term);
    }
    *values() {
        yield* this.slots.values();
    }
    keys() {
        return this.values();
    }
    *entries() {
        for (const term of this.slots.values())
            yield [term, term];
    }
    forEach(callbackfn) {
        for (const term of this.slots.values()) {
            callbackfn(term, term, this);
        }
    }
    toArray() {
        return [...this.slots.values()];
    }
}
