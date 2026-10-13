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

/**
 * Create a derived atom from one or more source atoms.
 *
 * @param sources — Single source atom, or array of source atoms
 * @param fn — Pure function computing the derived value from source values
 * @param equal — Optional equality function to prevent churn (default: `Object.is`)
 * @returns A read-only atom that updates when any source changes and `equal` returns false
 */
export function derived<T>(
  sources: Readable<unknown> | readonly Readable<unknown>[],
  fn: (values: unknown | readonly unknown[]) => T,
  equal: (a: T, b: T) => boolean = defaultEqual
): Readable<T> {
  const sourceArray = Array.isArray(sources) ? sources : [sources];

  // Initial value
  const initialValues = sourceArray.map((s) => s.get());
  let currentValue = fn(initialValues);

  const derivedAtom = atom<T>(currentValue);

  // Subscribe to all sources
  for (const source of sourceArray) {
    source.subscribe(() => {
      const nextValues = sourceArray.map((s) => s.get());
      const nextValue = fn(nextValues);
      if (!equal(currentValue, nextValue)) {
        currentValue = nextValue;
        derivedAtom.set(nextValue);
      }
    });
  }

  return {
    get: derivedAtom.get,
    subscribe: derivedAtom.subscribe.bind(derivedAtom),
  } as Readable<T>;
}

/**
 * Create a derived atom that only notifies on deep equality change.
 * Convenience for Sets, Maps, Arrays.
 */
export function derivedDeep<T>(
  sources: Readable<unknown> | readonly Readable<unknown>[],
  fn: (values: unknown | readonly unknown[]) => T
): Readable<T> {
  return derived(sources, fn, (a, b) => {
    if (Object.is(a, b)) return true;
    if (a instanceof Set && b instanceof Set) return setEqual(a, b);
    if (a instanceof Map && b instanceof Map) return mapEqual(a, b);
    if (Array.isArray(a) && Array.isArray(b)) return arrayEqual(a, b);
    return false;
  });
}