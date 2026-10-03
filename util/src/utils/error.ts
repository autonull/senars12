/**
 * The one coercion pair for values that reach an `Error` boundary from anywhere.
 *
 * Every catch site wants the same two things — the message to log and the error
 * to rethrow — and had spelled out its own ternary for each, with a fallback
 * string that differed per site.
 *
 * `fallback` is for the throw-site, where a non-`Error` carries no message and
 * `String(e)` would read as `undefined` next to real stack frames; the log-site
 * has no such need and should not invent one.
 */
export const errMsg = (e: unknown, fallback?: string): string =>
  e instanceof Error ? e.message : (fallback ?? String(e));

export const toError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)));
