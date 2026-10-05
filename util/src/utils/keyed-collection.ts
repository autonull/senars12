/**
 * Generic base class for collections keyed by a derived identity.
 *
 * One `Map` keyed by the derived identity holds both membership and iteration
 * order. This replaces the parallel array + side index pattern that made
 * deletes O(n) — `Map` already iterates in insertion order, so the array was a
 * hand-rolled copy of what the structure gives away.
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

  /** Index-free iterator over values with a projection. */
  protected iterProject<U>(project: (item: V) => U): IterableIterator<U> {
    const values = this.slots.values();
    const it: IterableIterator<U> = {
      next: (): IteratorResult<U> => {
        const step = values.next();
        return step.done
          ? { value: undefined, done: true }
          : { value: project(step.value), done: false };
      },
      [Symbol.iterator](): IterableIterator<U> {
        return it;
      },
    };
    return it;
  }
}

/**
 * Map-like collection with derived keys.
 *
 * @example
 * ```typescript
 * class UserByEmail extends KeyedMap<string, User, string> {
 *   protected deriveKey(email: string): string {
 *     return email.toLowerCase();
 *   }
 * }
 * ```
 */
export abstract class KeyedMap<K, V, DerivedKey extends PropertyKey = string> extends KeyedCollection<K, V, DerivedKey> {
  get(key: K): V | undefined {
    return this.getEntry(key);
  }

  set(key: K, value: V): this {
    return this.setEntry(key, value);
  }

  has(key: K): boolean {
    return this.hasKey(key);
  }

  delete(key: K): boolean {
    return this.deleteEntry(key);
  }

  keys(): IterableIterator<K> {
    return this.iterProject((entry) => entry as unknown as K);
  }

  values(): IterableIterator<V> {
    return this.iterProject((v) => v);
  }

  entries(): IterableIterator<[K, V]> {
    return this.iterProject((v) => [this.keyOfValue(v), v] as [K, V]);
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.entries();
  }

  forEach(callbackfn: (value: V, key: K, map: this) => void): void {
    for (const [derivedKey, value] of this.slots) {
      callbackfn(value, this.keyOfValue(value), this);
    }
  }

  /** Override to map a value back to its user-facing key (for entries/forEach). */
  protected abstract keyOfValue(value: V): K;
}

/**
 * Set-like collection with derived keys.
 *
 * @example
 * ```typescript
 * class LowercaseSet extends KeyedSet<string, string> {
 *   protected deriveKey(key: string): string {
 *     return key.toLowerCase();
 *   }
 *   protected keyOfValue(value: string): string {
 *     return value;
 *   }
 * }
 * ```
 */
export abstract class KeyedSet<K, DerivedKey extends PropertyKey = string> extends KeyedCollection<K, K, DerivedKey> {
  add(key: K): this {
    this.setEntry(key, key);
    return this;
  }

  has(key: K): boolean {
    return this.hasKey(key);
  }

  delete(key: K): boolean {
    return this.deleteEntry(key);
  }

  values(): IterableIterator<K> {
    return this.iterProject((v) => v);
  }

  keys(): IterableIterator<K> {
    return this.values();
  }

  entries(): IterableIterator<[K, K]> {
    return this.iterProject((v) => [v, v] as [K, K]);
  }

  forEach(callbackfn: (value: K, key: K, set: this) => void): void {
    for (const value of this.slots.values()) {
      callbackfn(value, value, this);
    }
  }

  toArray(): K[] {
    return [...this.slots.values()];
  }

  protected keyOfValue(value: K): K {
    return value;
  }
}