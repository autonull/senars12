/**
 * Narrowing guards and the array normalizers built on them. Everything here
 * answers "what shape is this value" without knowing what it is for.
 */
export const isNil = (value: unknown): value is null | undefined => value == null;

export const ensureArray = <T>(arr: T | T[] | undefined | null): T[] =>
  arr == null ? [] : Array.isArray(arr) ? arr : [arr];

export const compact = <T>(arr: (T | null | undefined | false | '' | 0)[]): T[] =>
  arr.filter(Boolean) as T[];

/** Plain-object guard — the one object test behind config merging and tool schemas. */
export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
