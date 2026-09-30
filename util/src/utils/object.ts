/**
 * Object-graph operations: merge, freeze, dotted-path access, and structural
 * comparison. The last one is deliberately a walk rather than a digest — see
 * {@link deepEqual}.
 */
import { isPlainObject } from './guards.js';

/**
 * Recursively merge `override` onto `base`. Plain objects merge key-by-key;
 * arrays and primitives replace wholesale, so a partial config narrows a list
 * rather than interleaving with the default. `undefined` overrides are skipped.
 */
export const deepMerge = <T>(base: T, override: unknown): T => {
  if (!isPlainObject(base) || !isPlainObject(override)) return override as T;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    merged[key] = key in merged ? deepMerge(merged[key], value) : value;
  }
  return merged as T;
};

/** Dotted-path read; missing or non-object segments yield `undefined`. */
export const getNested = (obj: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>((node, key) => (node as Record<string, unknown> | null)?.[key], obj);

/** Dotted-path write, creating missing intermediate objects. */
export function setNested(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys.slice(0, -1)) {
    if (typeof current[key] !== 'object' || current[key] === null) current[key] = {};
    current = current[key] as Record<string, unknown>;
  }
  const lastKey = keys[keys.length - 1];
  if (lastKey !== undefined) current[lastKey] = value;
}

/** Recursively freeze an object graph. Arrays and nested objects included. */
export const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
};

/** The defined keys of a plain object — the members a digest would have kept. */
const definedKeys = (value: Record<string, unknown>): string[] =>
  Object.keys(value).filter((key) => value[key] !== undefined);

/**
 * Structural equality, order-insensitive for object keys and order-sensitive for
 * arrays — the same contract `stableStringify` gives, without serializing.
 *
 * The digest spelling of this compared two full recursive JSON encodings, which
 * allocates an entries array, a filter array, a sort array and a mapped string
 * at every node of both graphs. That is affordable once and a cliff in a
 * comparison loop, and the one caller that compares per key during a
 * configuration sweep was already paying it.
 */
export const deepEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
    const left = a as ArrayLike<number>;
    const right = b as ArrayLike<number>;
    if (!ArrayBuffer.isView(a) || !ArrayBuffer.isView(b) || left.length !== right.length) {
      return false;
    }
    for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return false;
    return true;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }

  const left = definedKeys(a as Record<string, unknown>);
  const right = new Set(definedKeys(b as Record<string, unknown>));
  if (left.length !== right.size) return false;
  return left.every(
    (key) =>
      right.has(key) &&
      deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
  );
};
