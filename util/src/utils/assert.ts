/**
 * Failure-on-missing for lookups whose absence is a programming error rather
 * than a state to report. Returns the value so a `get`-then-throw helper is one
 * expression, which is the shape most of them wanted to be.
 */
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertDefined<T>(value: T | null | undefined, message: string): T {
  if (value == null) throw new Error(message);
  return value;
}
