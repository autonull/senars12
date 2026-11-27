/**
 * Base Registry — shared registry implementation for type-safe registries.
 *
 * Provides a common foundation for FacultyRegistry, OracleRegistry, and other registries.
 */
import { SenarsError } from '../errors/senars-error';
/**
 * Base registry class with common CRUD operations.
 * Subclasses define the key type and value type.
 */
export class BaseRegistry {
    map = new Map();
    options;
    constructor(options = {}) {
        this.options = {
            unique: options.unique ?? true,
            duplicateError: options.duplicateError ?? ((key) => `Duplicate registration for key: ${String(key)}`),
        };
    }
    /** Register a value. Throws if key already exists and unique is true. */
    register(value) {
        const key = this.getKey(value);
        if (this.options.unique && this.map.has(key)) {
            throw new SenarsError(this.options.duplicateError(key), 'VALIDATION_ERROR', { key: String(key) });
        }
        this.map.set(key, value);
    }
    /** Get a value by key. */
    get(key) {
        return this.map.get(key);
    }
    /** Get all registered values in registration order. */
    getAll() {
        return Array.from(this.map.values());
    }
    /** Check if a key is registered. */
    has(key) {
        return this.map.has(key);
    }
    /** Number of registered values. */
    get size() {
        return this.map.size;
    }
    /** Clear all registrations. */
    clear() {
        this.map.clear();
    }
    /** Delete a registration by key. */
    delete(key) {
        return this.map.delete(key);
    }
    /** Iterate registered values. */
    *[Symbol.iterator]() {
        yield* this.map.values();
    }
}
/**
 * Registry keyed by a string `id` property on the value.
 */
export class IdRegistry extends BaseRegistry {
    getKey(value) {
        return value.id;
    }
}
/**
 * Registry keyed by a string `name` property on the value.
 */
export class NameRegistry extends BaseRegistry {
    getKey(value) {
        return value.name;
    }
}
/**
 * Registry with a custom key extractor function.
 */
export class FunctionRegistry extends BaseRegistry {
    keyOf;
    constructor(keyOf, options) {
        super(options);
        this.keyOf = keyOf;
    }
    getKey(value) {
        return this.keyOf(value);
    }
}
