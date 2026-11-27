/**
 * Narrowing guards and the array normalizers built on them. Everything here
 * answers "what shape is this value" without knowing what it is for.
 */
export const isNil = (value) => value == null;
export const ensureArray = (arr) => arr == null ? [] : Array.isArray(arr) ? arr : [arr];
export const compact = (arr) => arr.filter(Boolean);
/** Plain-object guard — the one object test behind config merging and tool schemas. */
export const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
