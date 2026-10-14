/**
 * derived — a read-only atom computed from one or more source atoms.
 *
 * Replaces ad-hoc `subscribe` + `set` patterns that sync atoms by side effect.
 * Provides value equality to prevent churn (no notification when value is `equal`).
 *
 * The `equal` function defaults to `Object.is` for primitives and shallow
 * reference equality for objects — override for deep equality (e.g., Sets).
 */

import { atom, type Readable } from '../kernel/state.js';

/** Default equality: `Object.is` for primitives, reference for objects. */
export function defaultEqual<T>(a: T, b: T): boolean {
  return Object.is(a, b);
}

/** Set equality (for `derived` sources that are Sets). */
export function setEqual<T>(a: ReadonlySet<T> | undefined, b: ReadonlySet<T> | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/** Map equality (for `derived` sources that are Maps). */
export function mapEqual<K, V>(a: ReadonlyMap<K, V>, b: ReadonlyMap<K, V>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (!Object.is(b.get(k), v)) return false;
  return true;
}

/** Array equality (shallow, by index). */
export function arrayEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
}

type Equal<T> = (a: T, b: T) => boolean;

/**
 * Create a derived atom from a single source. `fn` receives the source value.
 */
export function derived<S, T>(source: Readable<S>, fn: (value: S) => T, equal?: Equal<T>): Readable<T>;
/**
 * Create a derived atom from multiple sources. `fn` receives the source values.
 */
export function derived<T>(
  sources: readonly Readable<unknown>[],
  fn: (values: readonly unknown[]) => T,
  equal?: Equal<T>
): Readable<T>;
export function derived(
  sources: Readable<unknown> | readonly Readable<unknown>[],
  fn: (value: never) => unknown,
  equal: (a: unknown, b: unknown) => boolean = defaultEqual
): Readable<unknown> {
  const sourceArray = Array.isArray(sources) ? sources : [sources];
  const isMulti = Array.isArray(sources);
  const compute = (): unknown =>
    fn((isMulti ? sourceArray.map((s) => s.get()) : sourceArray[0]?.get()) as never);

  let currentValue = compute();
  const derivedAtom = atom<unknown>(currentValue);

  for (const source of sourceArray) {
    source.subscribe(() => {
      const nextValue = compute();
      if (!equal(currentValue, nextValue)) {
        currentValue = nextValue;
        derivedAtom.set(nextValue);
      }
    });
  }

  return {
    get: () => derivedAtom.get(),
    subscribe: (fn) => derivedAtom.subscribe(fn),
  } as Readable<unknown>;
}

/** Equality that also compares Sets, Maps and Arrays by value. */
function deepEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (a instanceof Set && b instanceof Set) return setEqual(a, b);
  if (a instanceof Map && b instanceof Map) return mapEqual(a, b);
  if (Array.isArray(a) && Array.isArray(b)) return arrayEqual(a, b);
  return false;
}

/**
 * Create a derived atom that only notifies on deep equality change.
 * Convenience for Sets, Maps, Arrays.
 */
export function derivedDeep<S, T>(source: Readable<S>, fn: (value: S) => T): Readable<T>;
export function derivedDeep<T>(
  sources: readonly Readable<unknown>[],
  fn: (values: readonly unknown[]) => T
): Readable<T>;
export function derivedDeep(
  sources: Readable<unknown> | readonly Readable<unknown>[],
  fn: (value: never) => unknown
): Readable<unknown> {
  return derived(sources as Readable<unknown>, fn as (value: unknown) => unknown, deepEqual);
}
