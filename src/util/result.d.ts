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
export type Ok<T> = {
    readonly ok: true;
    readonly value: T;
};
export type Err<E> = {
    readonly ok: false;
    readonly error: E;
};
export type Result<T, E = Error> = Ok<T> | Err<E>;
export declare const ok: <T>(value: T) => Ok<T>;
export declare const err: <E>(error: E) => Err<E>;
export declare const isOk: <T, E>(result: Result<T, E>) => result is Ok<T>;
export declare const isErr: <T, E>(result: Result<T, E>) => result is Err<E>;
export declare const map: <T, U, E>(result: Result<T, E>, fn: (value: T) => U) => Result<U, E>;
export declare const mapErr: <T, E, F>(result: Result<T, E>, fn: (error: E) => F) => Result<T, F>;
export declare const flatMap: <T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>) => Result<U, E>;
export declare const getOrElse: <T, E>(result: Result<T, E>, fallback: (error: E) => T) => T;
/**
 * Fold both arms into one value — the terminal operation, so a caller
 * accumulating into an error list writes one `reduce` rather than an
 * `if (result.ok)` per step.
 */
export declare const match: <T, E, R>(result: Result<T, E>, { onOk, onErr: onError }: {
    onOk: (value: T) => R;
    onErr: (error: E) => R;
}) => R;
export declare const unwrapOrThrow: <T, E extends Error>(result: Result<T, E>) => T;
/** Run a sync fallible fn, capturing thrown errors into a Result. */
export declare const attempt: <T>(fn: () => T) => Result<T, Error>;
/** Run an async fallible fn, capturing rejections into a Result. */
export declare const attemptAsync: <T>(fn: () => Promise<T>) => Promise<Result<T, Error>>;
//# sourceMappingURL=result.d.ts.map