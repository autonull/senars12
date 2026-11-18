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

/**
 * Run a call whose failure is expected, report it, and answer `onFailure`.
 *
 * Not {@link import('./result.js').attempt}, which *carries* a failure for a
 * caller to inspect. This one subsides it: the caller has already decided what
 * the system does without the answer.
 *
 * The model is untrusted infrastructure: a provider goes away mid-cycle and the
 * cycle still has to finish with something; a transport drops and the REPL still
 * has to print a line. Twenty-eight sites wrote that try/catch/report and differ
 * only in the message and the empty value — which is how the log line for a
 * degraded cycle varied with which method happened to fail.
 *
 * `onFailure` receives the error, so a caller whose answer *is* the failure (a
 * REPL line naming the command that failed) uses this rather than keeping a
 * second funnel beside it.
 *
 * The thunk must contain the call and nothing else. A throw from a local
 * transform on the way out is a bug in the transform, not a provider failure,
 * and answering it with a fallback silently hides that; one call site had been
 * catching exactly that and reporting it as a model failure.
 */
export const degrade = async <T>(
  logger: Pick<Console, 'warn'>,
  what: string,
  call: () => Promise<T> | T,
  onFailure: (error: unknown) => T
): Promise<T> => {
  try {
    return await call();
  } catch (error) {
    logger.warn(`${what}: ${errMsg(error)}`);
    return onFailure(error);
  }
};
