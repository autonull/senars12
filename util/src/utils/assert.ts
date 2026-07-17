export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertDefined<T>(value: T | null | undefined, message: string): asserts value is T {
  if (value == null) throw new Error(message);
}
