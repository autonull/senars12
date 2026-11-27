import { errMsg } from '../util/error';
import { attemptAsync, match } from '../util/result';
/** A successful outcome. */
export const toolOk = (content, extra) => ({
    success: true,
    content,
    ...extra,
});
/** A failed outcome; anything thrown is stringified at this boundary. */
export const toolError = (error, extra) => ({
    success: false,
    content: null,
    error: errMsg(error),
    ...extra,
});
/**
 * A tool body wrapped in its own failure contract. Every tool hand-wrote
 * `try { toolOk(await run()) } catch { toolError(\`${label}: ${errMsg(e)}\`) }`, and the
 * four labels in production code differed only in wording — two of them dropped
 * the label and reported a bare message. `label` is the parameter those four sites
 * were missing.
 */
export const toolAttempt = async (label, run, content = (value) => value) => {
    const outcome = await attemptAsync(async () => content(await run()));
    return match(outcome, {
        onOk: toolOk,
        onErr: (e) => toolError(`${label}: ${errMsg(e)}`),
    });
};
