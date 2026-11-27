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
import { toError } from './error';
export const ok = (value) => ({ ok: true, value });
export const err = (error) => ({ ok: false, error });
export const isOk = (result) => result.ok;
export const isErr = (result) => !result.ok;
export const map = (result, fn) => result.ok ? ok(fn(result.value)) : result;
export const mapErr = (result, fn) => result.ok ? result : err(fn(result.error));
export const flatMap = (result, fn) => (result.ok ? fn(result.value) : result);
export const getOrElse = (result, fallback) => result.ok ? result.value : fallback(result.error);
/**
 * Fold both arms into one value — the terminal operation, so a caller
 * accumulating into an error list writes one `reduce` rather than an
 * `if (result.ok)` per step.
 */
export const match = (result, { onOk, onErr: onError }) => (result.ok ? onOk(result.value) : onError(result.error));
export const unwrapOrThrow = (result) => {
    if (result.ok)
        return result.value;
    throw result.error;
};
/** Run a sync fallible fn, capturing thrown errors into a Result. */
export const attempt = (fn) => {
    try {
        return ok(fn());
    }
    catch (error) {
        return err(toError(error));
    }
};
/** Run an async fallible fn, capturing rejections into a Result. */
export const attemptAsync = async (fn) => {
    try {
        return ok(await fn());
    }
    catch (error) {
        return err(toError(error));
    }
};
