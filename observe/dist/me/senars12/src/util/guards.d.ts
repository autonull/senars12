/**
 * Narrowing guards and the array normalizers built on them. Everything here
 * answers "what shape is this value" without knowing what it is for.
 */
export declare const isNil: (value: unknown) => value is null | undefined;
export declare const ensureArray: <T>(arr: T | T[] | undefined | null) => T[];
export declare const compact: <T>(arr: (T | null | undefined | false | '' | 0)[]) => T[];
/** Plain-object guard — the one object test behind config merging and tool schemas. */
export declare const isPlainObject: (v: unknown) => v is Record<string, unknown>;
//# sourceMappingURL=guards.d.ts.map