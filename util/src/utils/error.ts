/**
 * The one coercion pair for values that reach an `Error` boundary from anywhere.
 *
 * Every catch site wants the same two things — the message to log and the error
 * to rethrow — and had spelled out its own ternary for each, with a fallback
 * string that differed per site.
 */
export const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export const toError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)));
