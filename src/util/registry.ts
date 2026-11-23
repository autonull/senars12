/**
 * Base Registry — shared registry implementation for type-safe registries.
 *
 * Provides a common foundation for FacultyRegistry, OracleRegistry, and other registries.
 */

import { SenarsError } from '../errors/senars-error';

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
export abstract class BaseRegistry<K, V> {
  protected readonly map = new Map<K, V>();
  protected readonly options: Required<RegistryOptions<K>>;

  constructor(options: RegistryOptions<K> = {}) {
    this.options = {
      unique: options.unique ?? true,
      duplicateError: options.duplicateError ?? ((key) => `Duplicate registration for key: ${String(key)}`),
    };
  }

  /** Register a value. Throws if key already exists and unique is true. */
  register(value: V): void {
    const key = this.getKey(value);
    if (this.options.unique && this.map.has(key)) {
      throw new SenarsError(this.options.duplicateError(key), 'VALIDATION_ERROR', { key: String(key) });
    }
    this.map.set(key, value);
  }

  /** Get a value by key. */
  get(key: K): V | undefined {
    return this.map.get(key);
  }

  /** Get all registered values in registration order. */
  getAll(): V[] {
    return Array.from(this.map.values());
  }

  /** Check if a key is registered. */
  has(key: K): boolean {
    return this.map.has(key);
  }

  /** Number of registered values. */
  get size(): number {
    return this.map.size;
  }

  /** Clear all registrations. */
  clear(): void {
    this.map.clear();
  }

  /** Delete a registration by key. */
  delete(key: K): boolean {
    return this.map.delete(key);
  }

  /** Iterate registered values. */
  *[Symbol.iterator](): IterableIterator<V> {
    yield* this.map.values();
  }

  /** Abstract method to extract key from value. */
  protected abstract getKey(value: V): K;
}

/**
 * Registry keyed by a string `id` property on the value.
 */
export abstract class IdRegistry<V extends { id: string }> extends BaseRegistry<string, V> {
  protected getKey(value: V): string {
    return value.id;
  }
}

/**
 * Registry keyed by a string `name` property on the value.
 */
export abstract class NameRegistry<V extends { name: string }> extends BaseRegistry<string, V> {
  protected getKey(value: V): string {
    return value.name;
  }
}

/**
 * Registry with a custom key extractor function.
 */
export class FunctionRegistry<K, V> extends BaseRegistry<K, V> {
  private readonly keyOf: (value: V) => K;

  constructor(keyOf: (value: V) => K, options?: RegistryOptions<K>) {
    super(options);
    this.keyOf = keyOf;
  }

  protected getKey(value: V): K {
    return this.keyOf(value);
  }
}