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
export declare const deepMerge: <T>(base: T, override: unknown) => T;
/** Dotted-path read; missing or non-object segments yield `undefined`. */
export declare const getNested: (obj: unknown, path: string) => unknown;
/** Dotted-path write, creating missing intermediate objects. */
export declare function setNested(obj: Record<string, unknown>, path: string, value: unknown): void;
/** Recursively freeze an object graph. Arrays and nested objects included. */
export declare const deepFreeze: <T>(value: T) => T;
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
export declare const thaw: <T>(value: T) => T;
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
export declare const deepEqual: (a: unknown, b: unknown) => boolean;
//# sourceMappingURL=object.d.ts.map