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
 *
 * The result shares **no plain-object branch** with `base`: every object the
 * override does not mention is copied, at any depth. That is the whole contract,
 * because a caller writes into what it gets back — `mergeParameters` feeds the
 * result to a tuner that sets dotted paths through it, and `loadConfig` stamps a
 * version onto it. Sharing an untouched branch would write into a frozen default,
 * or into another caller's config, and the damage would surface as state that
 * changes between two constructions that read identically.
 *
 * A previous spelling of this merged shallowly and copied a hand-listed set of
 * nested leaves, so the guarantee held only for the leaves someone remembered.
 */
export const deepMerge = <T>(base: T, override: unknown): T => {
  if (!isPlainObject(base) || !isPlainObject(override)) return override as T;
  const over = override as Record<string, unknown>;
  const baseKeys = new Set(Object.keys(base));
  const merged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(base)) {
    const own = over[key];
    merged[key] = own === undefined ? freshBranch(value) : deepMerge(value, own);
  }
  for (const [key, value] of Object.entries(over)) {
    if (value !== undefined && !baseKeys.has(key)) merged[key] = value;
  }
  return merged as T;
};

/**
 * A base branch the override never mentions, taken as a fresh object graph. Arrays
 * and primitives pass through: this system treats them as immutable, and a partial
 * config is not permitted to interleave with a default list.
 */
const freshBranch = (value: unknown): unknown =>
  isPlainObject(value) ? deepMerge(value, {}) : value;

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

/**
 * A mutable copy of a frozen object graph — the inverse of `deepFreeze`, and what
 * a caller that needs to *own* a configuration actually wants.
 *
 * `structuredClone` also produces an unfrozen copy, but it is a *serialising*
 * clone: it drops every `undefined` property, rejects functions and symbols, and
 * throws outright on anything it cannot encode. A frozen default that round-trips
 * through it is not the value it started as — it is the same shape with holes in
 * it, a difference no caller asked for and none would notice.
 *
 * **Copyable means "a bag of named values", not merely "an object".** A `Date`, a
 * `Map`, a class instance holds its state somewhere other than its own enumerable
 * properties, so copying those properties produces an empty shell — a `Date` that
 * is now `{}`, which reads as a valid value until someone calls a method on it.
 * Those are shared instead: sharing costs nothing when they are immutable, and a
 * half-copied object is not a cheaper way to be wrong.
 */
export const thaw = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(thaw) as T;
  if (!isCopyable(value)) return value;
  const copy: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) copy[key] = thaw(child);
  return copy as T;
};

const isCopyable = (value: unknown): value is Record<string, unknown> => {
  if (!isPlainObject(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
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
