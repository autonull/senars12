/**
 * Base Registry — shared registry implementation for type-safe registries.
 *
 * Provides a common foundation for FacultyRegistry, OracleRegistry, and other registries.
 */
export interface RegistryOptions<K> {
    /** Whether duplicate keys throw (default true). */
    unique?: boolean;
    /** Custom error message for duplicate keys. */
    duplicateError?: (key: K) => string;
}
/**
 * Base registry class with common CRUD operations.
 * Subclasses define the key type and value type.
 */
export declare abstract class BaseRegistry<K, V> {
    protected readonly map: Map<K, V>;
    protected readonly options: Required<RegistryOptions<K>>;
    constructor(options?: RegistryOptions<K>);
    /** Register a value. Throws if key already exists and unique is true. */
    register(value: V): void;
    /** Get a value by key. */
    get(key: K): V | undefined;
    /** Get all registered values in registration order. */
    getAll(): V[];
    /** Check if a key is registered. */
    has(key: K): boolean;
    /** Number of registered values. */
    get size(): number;
    /** Clear all registrations. */
    clear(): void;
    /** Delete a registration by key. */
    delete(key: K): boolean;
    /** Iterate registered values. */
    [Symbol.iterator](): IterableIterator<V>;
    /** Abstract method to extract key from value. */
    protected abstract getKey(value: V): K;
}
/**
 * Registry keyed by a string `id` property on the value.
 */
export declare abstract class IdRegistry<V extends {
    id: string;
}> extends BaseRegistry<string, V> {
    protected getKey(value: V): string;
}
/**
 * Registry keyed by a string `name` property on the value.
 */
export declare abstract class NameRegistry<V extends {
    name: string;
}> extends BaseRegistry<string, V> {
    protected getKey(value: V): string;
}
/**
 * Registry with a custom key extractor function.
 */
export declare class FunctionRegistry<K, V> extends BaseRegistry<K, V> {
    private readonly keyOf;
    constructor(keyOf: (value: V) => K, options?: RegistryOptions<K>);
    protected getKey(value: V): K;
}
//# sourceMappingURL=registry.d.ts.map