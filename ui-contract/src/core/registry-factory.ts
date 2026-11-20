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
 * Create a registry API from core entries and options.
 * Returns an object with all standard registry functions.
 * Extra queries should be added after creation to avoid circular references.
 */
export function createRegistry<T>(
  options: RegistryFactoryOptions<T>
): RegistryAPI<T> {
  const { registryName, coreEntries, keyOf } = options;

  const registry = new Map<string, T>();
  const registrationOrder: string[] = [];

  const register = (entry: T): void => {
    const key = keyOf(entry);
    if (registry.has(key)) {
      console.warn(`${registryName} ${key} already registered; overwriting`);
    } else {
      registrationOrder.push(key);
    }
    registry.set(key, entry);
  };

  const get = (id: string): T | undefined => registry.get(id);

  const getAll = (): readonly T[] => registrationOrder.map((id) => registry.get(id)!);

  const has = (id: string): boolean => registry.has(id);

  const ids = (): readonly string[] => [...registrationOrder];

  const reset = (): void => {
    registry.clear();
    registrationOrder.length = 0;
  };

  // Register core entries immediately
  for (const entry of coreEntries) register(entry);

  // Build the base API
  const api: RegistryAPI<T> = {
    register,
    get,
    getAll,
    has,
    ids,
    reset,
  };

  return api;
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