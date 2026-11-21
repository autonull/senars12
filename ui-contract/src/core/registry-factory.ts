/**
 * Generic registry factory — eliminates duplicated registry implementations.
 *
 * Every open registry in ui-contract follows the same pattern:
 * - Map for storage
 * - Array for registration order
 * - register/get/has/all/ids/reset functions
 *
 * This factory generates the registry API from a type and core entries.
 * The CORE_* constants and registerCore* function remain in each registry file.
 */

export interface RegistryEntry {
  readonly [key: string]: unknown;
}

/** Factory API — used by internal registries (shape, aspect, focus-kind, arrangement, channel). */
export interface RegistryAPI<T> {
  readonly register: (entry: T) => void;
  readonly get: (id: string) => T | undefined;
  readonly getAll: () => readonly T[];
  readonly has: (id: string) => boolean;
  readonly ids: () => readonly string[];
  readonly reset: () => void;
}

export interface RegistryFactoryOptions<T> {
  /** Unique identifier for this registry (used in warnings). */
  readonly registryName: string;
  /** Core entries to register by default. */
  readonly coreEntries: readonly T[];
  /** Required: custom key extractor (e.g., (e) => e.id, (e) => e.kind, (e) => e.aspect). */
  readonly keyOf: (entry: T) => string;
}

/**
 * Type helper to extract the entry type from a registry API.
 */
export type RegistryEntryOf<T> = T extends RegistryAPI<infer E> ? E : never;

/**
 * Type helper for the registered ID type (exhaustiveness checking).
 * Uses the keyOf function's return type.
 */
export type RegisteredId<T, TKeyOf extends (entry: T) => string> = ReturnType<TKeyOf>;

// ─────────────────────────────────────────────────────────────────────────────
// Simple API — used by ui-shell, ui, and external consumers
// ─────────────────────────────────────────────────────────────────────────────

/** Options for simple registry creation. */
export interface RegistryOptions {
  /** Whether duplicate keys throw (default false). */
  unique?: boolean;
}

/** Simple registry interface — compatible with ui-shell and ui consumers. */
export interface Registry<K, V> {
  /** Register a value. Throws if `keyOf(value)` already registered (when `unique: true`). */
  register(value: V): void;
  /** Get a value by key. */
  get(key: K): V | undefined;
  /** All registered values, in registration order. */
  all(): readonly V[];
  /** Whether a key is registered. */
  has(key: K): boolean;
  /** Number of registered values. */
  readonly size: number;
  /** All registered keys, in registration order. */
  readonly ids: readonly K[];
  /** Clear all registrations. */
  reset(): void;
  /** Iterate registered values. */
  [Symbol.iterator](): IterableIterator<V>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified implementation
// ─────────────────────────────────────────────────────────────────────────────

interface InternalRegistryOptions<V = unknown> {
  unique?: boolean;
  coreEntries?: readonly V[];
  registryName?: string;
}

interface InternalRegistryAPI<K, V> {
  register: (value: V) => void;
  get: (key: K) => V | undefined;
  getAll: () => readonly V[];
  has: (key: K) => boolean;
  ids: () => readonly K[];
  reset: () => void;
}

function createRegistryInternal<K, V>(
  keyOf: (value: V) => K,
  options: InternalRegistryOptions<V>
): InternalRegistryAPI<K, V> {
  const { unique = false, coreEntries = [], registryName } = options;

  const registry = new Map<K, V>();
  const registrationOrder: K[] = [];

  const register = (value: V): void => {
    const key = keyOf(value);
    if (unique && registry.has(key)) {
      throw new Error(`Duplicate registration for key: ${String(key)}`);
    }
    const isNew = !registry.has(key);
    if (isNew) {
      registrationOrder.push(key);
    } else if (registryName) {
      console.warn(`${registryName} ${String(key)} already registered; overwriting`);
    }
    registry.set(key, value);
  };

  const get = (key: K): V | undefined => registry.get(key);

  const getAll = (): readonly V[] => registrationOrder.map((id) => registry.get(id)!);

  const has = (key: K): boolean => registry.has(key);

  const ids = (): readonly K[] => [...registrationOrder];

  const reset = (): void => {
    registry.clear();
    registrationOrder.length = 0;
  };

  // Register core entries immediately
  for (const entry of coreEntries) register(entry);

  return { register, get, getAll, has, ids, reset };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — overloaded createRegistry for both factory and simple APIs
// ─────────────────────────────────────────────────────────────────────────────

/** Factory API: create a registry with core entries and warning-on-duplicate behavior. */
export function createRegistry<T>(options: RegistryFactoryOptions<T>): RegistryAPI<T>;

/** Simple API: create a registry keyed by keyOf with optional unique constraint. */
export function createRegistry<K, V>(keyOf: (value: V) => K, options?: RegistryOptions): Registry<K, V>;

/** Implementation for both overloads. */
export function createRegistry<T, K, V>(
  keyOrOptions: ((value: V) => K) | RegistryFactoryOptions<T>,
  options?: RegistryOptions
): RegistryAPI<T> | Registry<K, V> {
  // Factory API: first argument is an options object with registryName, coreEntries, keyOf
  if (typeof keyOrOptions === 'object' && keyOrOptions !== null && 'registryName' in keyOrOptions) {
    const factoryOptions = keyOrOptions as RegistryFactoryOptions<T>;
    const internal = createRegistryInternal<string, T>(
      factoryOptions.keyOf,
      { unique: false, coreEntries: factoryOptions.coreEntries, registryName: factoryOptions.registryName }
    );
    return {
      register: internal.register,
      get: internal.get,
      getAll: internal.getAll,
      has: internal.has,
      ids: internal.ids,
      reset: internal.reset,
    };
  }

  // Simple API: first argument is a keyOf function
  const keyOf = keyOrOptions as (value: V) => K;
  const { unique = false } = options ?? {};

  const internal = createRegistryInternal<K, V>(keyOf, { unique, coreEntries: [], registryName: '' });

  // Wrap to present simple API
  return {
    register: internal.register,
    get: internal.get,
    all: internal.getAll,
    has: internal.has,
    get size(): number {
      return internal.getAll().length;
    },
    get ids(): readonly K[] {
      return internal.ids() as readonly K[];
    },
    reset: internal.reset,
    *[Symbol.iterator](): IterableIterator<V> {
      yield* internal.getAll();
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