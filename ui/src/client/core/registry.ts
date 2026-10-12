/**
 * One registry shape, N domains (E2). `createRegistry(keyOf)` is the
 * metaprogramming seam: instantiate once, reuse everywhere. A domain is
 * `createRegistry<Shape, Descriptor>(d => d.id)`. The descriptor-to-registration
 * helpers (`defineSurface`, `defineOverlay`, etc.) sit on top.
 */

export interface Registry<K, V> {
  /** Register a value. Throws if `keyOf(value)` already registered (unless `unique: false`). */
  register(value: V): void;
  /** Get a value by key. */
  get(key: K): V | undefined;
  /** All registered values, in registration order. */
  all(): readonly V[];
  /** Whether a key is registered. */
  has(key: K): boolean;
  /** Number of registered values. */
  readonly size: number;
  /** Clear all registrations. */
  reset(): void;
  /** Iterate registered values. */
  [Symbol.iterator](): IterableIterator<V>;
}

export interface RegistryOptions {
  /** Whether duplicate keys throw (default true). */
  unique?: boolean;
}

/**
 * Create a registry keyed by `keyOf(value)`. The registry is a `Map<K, V>` with
 * a thin API that makes intent explicit (register/get/all/has/size) and is
 * trivially testable.
 */
export function createRegistry<K, V>(
  keyOf: (value: V) => K,
  options: RegistryOptions = {}
): Registry<K, V> {
  const { unique = false } = options;
  const registry = new Map<K, V>();

  return {
    register(value: V): void {
      const key = keyOf(value);
      if (unique && registry.has(key)) {
        throw new Error(`Duplicate registration for key: ${String(key)}`);
      }
      registry.set(key, value);
    },

    get(key: K): V | undefined {
      return registry.get(key);
    },

    all(): readonly V[] {
      return [...registry.values()];
    },

    has(key: K): boolean {
      return registry.has(key);
    },

    get size(): number {
      return registry.size;
    },

    reset(): void {
      registry.clear();
    },

    *[Symbol.iterator](): IterableIterator<V> {
      yield* registry.values();
    },
  };
}

/** Convenience: a registry keyed by `id` field. */
export function createIdRegistry<V extends { id: string }>(
  options?: RegistryOptions
): Registry<string, V> {
  return createRegistry((v) => v.id, options);
}

/** Convenience: a registry keyed by `label` field. */
export function createLabelRegistry<V extends { label: string }>(
  options?: RegistryOptions
): Registry<string, V> {
  return createRegistry((v) => v.label, options);
}