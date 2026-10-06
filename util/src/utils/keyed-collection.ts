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
export abstract class KeyedCollection<K, V, DerivedKey extends PropertyKey = string> {
  protected readonly slots = new Map<DerivedKey, V>();

  get size(): number {
    return this.slots.size;
  }

  clear(): void {
    this.slots.clear();
  }

  /** Derive the map key from the user-facing key. */
  protected abstract deriveKey(key: K): DerivedKey;

  protected hasKey(key: K): boolean {
    return this.slots.has(this.deriveKey(key));
  }

  protected getEntry(key: K): V | undefined {
    return this.slots.get(this.deriveKey(key));
  }

  protected setEntry(key: K, value: V): this {
    this.slots.set(this.deriveKey(key), value);
    return this;
  }

  protected deleteEntry(key: K): boolean {
    return this.slots.delete(this.deriveKey(key));
  }
}

export interface KeyedRegistryOptions<T> {
  /**
   * The item's identity. A registry is keyed by a property of the thing it holds
   * (`id`, `name`, …) rather than by a caller-supplied key, so a registered item
   * cannot be filed under a name it does not carry.
   */
  keyOf: (item: T) => string;
  /**
   * Called instead of the overwrite when a key arrives twice. Throw from it to
   * refuse; omit it and the last registration wins, which is what an
   * idempotent-per-id collection wants. Without this a duplicate either
   * overwrites silently or throws, decided per registry.
   */
  onDuplicate?: (key: string, incumbent: T) => void;
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
export class KeyedRegistry<T> extends KeyedCollection<string, T> {
  readonly #keyOf: (item: T) => string;
  readonly #onDuplicate?: (key: string, incumbent: T) => void;

  constructor({ keyOf, onDuplicate }: KeyedRegistryOptions<T>) {
    super();
    this.#keyOf = keyOf;
    this.#onDuplicate = onDuplicate;
  }

  /** A registry's key is the derived identity itself. */
  protected override deriveKey(key: string): string {
    return key;
  }

  register(item: T): this {
    const key = this.#keyOf(item);
    const incumbent = this.slots.get(key);
    if (incumbent !== undefined) this.#onDuplicate?.(key, incumbent);
    return this.setEntry(key, item);
  }

  get(key: string): T | undefined {
    return this.getEntry(key);
  }

  has(key: string): boolean {
    return this.hasKey(key);
  }

  delete(key: string): boolean {
    return this.deleteEntry(key);
  }

  keys(): string[] {
    return [...this.slots.keys()];
  }

  all(): T[] {
    return [...this.slots.values()];
  }
}
