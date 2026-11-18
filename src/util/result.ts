/**
 * The one fallible-result shape. It lives here rather than in `nar` because the
 * layers below `nar` need it too: a transport that cannot reach a peer, a plugin
 * that fails to load and an LM provider that gives up are all the same call
 * shape, and three of them spelled it out differently while the one package with
 * a copy could not be imported from them at all.
 *
 * A discriminated union on `ok`, so the narrow survives: `result.ok ? …` is the
 * only test needed and neither arm needs a cast.
 */

import { toError } from './error.js';

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E = Error> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.ok;
export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => !result.ok;

export const map = <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
  result.ok ? ok(fn(result.value)) : result;

export const mapErr = <T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> =>
  result.ok ? result : err(fn(result.error));

export const flatMap = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> => (result.ok ? fn(result.value) : result);

export const getOrElse = <T, E>(result: Result<T, E>, fallback: (error: E) => T): T =>
  result.ok ? result.value : fallback(result.error);

/**
 * Fold both arms into one value — the terminal operation, so a caller
 * accumulating into an error list writes one `reduce` rather than an
 * `if (result.ok)` per step.
 */
export const match = <T, E, R>(
  result: Result<T, E>,
  { onOk, onErr: onError }: { onOk: (value: T) => R; onErr: (error: E) => R }
): R => (result.ok ? onOk(result.value) : onError(result.error));

export const unwrapOrThrow = <T, E extends Error>(result: Result<T, E>): T => {
  if (result.ok) return result.value;
  throw result.error;
};

/** Run a sync fallible fn, capturing thrown errors into a Result. */
export const attempt = <T>(fn: () => T): Result<T, Error> => {
  try {
    return ok(fn());
  } catch (error) {
    return err(toError(error));
  }
};

/** Run an async fallible fn, capturing rejections into a Result. */
export const attemptAsync = async <T>(fn: () => Promise<T>): Promise<Result<T, Error>> => {
  try {
    return ok(await fn());
  } catch (error) {
    return err(toError(error));
  }
};
