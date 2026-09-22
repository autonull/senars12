/**
 * E2 (TODO20 Phase 3): canonical `Result` type — discriminated union for fallible
 * operations. Single definition; `types/core.ts` re-exports for the legacy barrel.
 */
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E = Error> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.ok;
export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => !result.ok;

export const map = <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
  result.ok ? ok(fn(result.value)) : result;

export const flatMap = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> => (result.ok ? fn(result.value) : result);

export const getOrElse = <T, E>(result: Result<T, E>, fallback: (error: E) => T): T =>
  result.ok ? result.value : fallback(result.error);

export const unwrapOrThrow = <T, E extends Error>(result: Result<T, E>): T => {
  if (result.ok) return result.value;
  throw result.error;
};

/** Run a sync fallible fn, capturing thrown errors into a Result. */
export const attempt = <T>(fn: () => T): Result<T, Error> => {
  try {
    return ok(fn());
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
};

/** Run an async fallible fn, capturing rejections into a Result. */
export const attemptAsync = async <T>(fn: () => Promise<T>): Promise<Result<T, Error>> => {
  try {
    return ok(await fn());
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
};
