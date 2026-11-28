/**
 * Failure-on-missing for lookups whose absence is a programming error rather
 * than a state to report. Returns the value so a `get`-then-throw helper is one
 * expression, which is the shape most of them wanted to be.
 */
export declare function invariant(condition: unknown, message: string): asserts condition;
export declare function assertDefined<T>(value: T | null | undefined, message: string): T;
//# sourceMappingURL=assert.d.ts.map