export interface Serializable<T, V = number> {
  serialize(): T;
  deserialize(data: T, version?: V): this;
  readonly version?: V;
}

export interface Versioned {
  readonly version: number;
}

/**
 * Wraps an object that already fulfills the instance-side contract
 * (`serialize()` + `deserialize(data): this`) as {@link Serializable}.
 */
export function asSerializable<T, V = number>(
  target: Serializable<T, V>,
): Serializable<T, V> {
  return target;
}

/**
 * Bridges a class whose instance `serialize()` pairs with an *in-place*
 * `deserialize(data)` (returning `void`) — the legacy pattern used by e.g.
 * `TranslationCache` — into the uniform {@link Serializable} contract. The
 * wrapper's `deserialize` invokes the instance method and returns the receiver.
 *
 * This lets pre-existing classes participate in the uniform contract without
 * changing their signatures (which would break callers).
 */
export function inPlaceSerializable<TData, V = number>(
  instance: { serialize(): TData; deserialize(data: TData): void },
  version?: V,
): Serializable<TData, V> {
  return {
    serialize: () => instance.serialize(),
    deserialize: (data: TData, _version?: V): Serializable<TData, V> => {
      instance.deserialize(data);
      return instance as unknown as Serializable<TData, V>;
    },
    ...(version !== undefined ? { version } : {}),
  };
}

/**
 * Bridges a class whose instance `serialize()` pairs with a *static factory*
 * `deserialize(data, ...args)` returning a new instance — the legacy pattern
 * used by e.g. `Bag`, `LinkManager`, `TermLayer` — into the uniform
 * {@link Serializable} contract.
 *
 * Because the factory produces a fresh instance, the wrapper exposes the most
 * recently deserialized value via {@link FactorySerializable.current} rather
 * than `this`. The `deserialize` method returns the wrapper (so it still
 * satisfies the contract's return type) and updates `current`.
 */
export interface FactorySerializable<TData, T, V = number> extends Serializable<TData, V> {
  readonly current: T;
}

export function factorySerializable<TData, T, V = number>(
  host: { serialize(): TData; factory: (data: TData, ...args: never[]) => T },
  version?: V,
  factoryArgs: never[] = [],
): FactorySerializable<TData, T, V> {
  let current = undefined as unknown as T;
  const wrapper: FactorySerializable<TData, T, V> = {
    get current(): T {
      return current;
    },
    serialize: () => host.serialize(),
    deserialize: (data: TData, _version?: V): FactorySerializable<TData, T, V> => {
      current = host.factory(data, ...factoryArgs);
      return wrapper;
    },
    ...(version !== undefined ? { version } : {}),
  };
  return wrapper;
}
