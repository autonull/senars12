/**
 * The two keyed substrates every named collection in the repository sits on.
 *
 * {@link KeyedCollection} is storage keyed by a *derived* identity: one `Map` holds
 * both membership and iteration order, so a delete is O(1) rather than a shift of
 * every index above the hole. {@link KeyedRegistry} is the registration policy on
 * top of it — what a key is derived from, and what a repeated key does.
 *
 * Four registries (cognition components, arcade games, tools, strategy
 * registrations) each carried their own `Map<string, T>` plus the same four
 * methods, and the one that differed — whether a second registration replaced or
 * refused — was a private branch in each rather than a declared policy.
 */
export class KeyedCollection {
    slots = new Map();
    get size() {
        return this.slots.size;
    }
    clear() {
        this.slots.clear();
    }
    hasKey(key) {
        return this.slots.has(this.deriveKey(key));
    }
    getEntry(key) {
        return this.slots.get(this.deriveKey(key));
    }
    setEntry(key, value) {
        this.slots.set(this.deriveKey(key), value);
        return this;
    }
    deleteEntry(key) {
        return this.slots.delete(this.deriveKey(key));
    }
}
/**
 * A named collection of registered items: {@link KeyedCollection} with the
 * registration policy declared once.
 *
 * @example
 * ```typescript
 * class SensorRegistry extends KeyedRegistry<Sensor> {
 *   constructor() {
 *     super({ keyOf: (sensor) => sensor.id });
 *   }
 * }
 * ```
 */
export class KeyedRegistry extends KeyedCollection {
    #keyOf;
    #onDuplicate;
    constructor({ keyOf, onDuplicate }) {
        super();
        this.#keyOf = keyOf;
        this.#onDuplicate = onDuplicate;
    }
    /** A registry's key is the derived identity itself. */
    deriveKey(key) {
        return key;
    }
    register(item) {
        const key = this.#keyOf(item);
        const incumbent = this.slots.get(key);
        if (incumbent !== undefined)
            this.#onDuplicate?.(key, incumbent);
        return this.setEntry(key, item);
    }
    get(key) {
        return this.getEntry(key);
    }
    has(key) {
        return this.hasKey(key);
    }
    delete(key) {
        return this.deleteEntry(key);
    }
    keys() {
        return [...this.slots.keys()];
    }
    all() {
        return [...this.slots.values()];
    }
}
