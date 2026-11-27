import { errMsg } from '../util/error';
export class SenarsError extends Error {
    code;
    context;
    constructor(message, code, context, options) {
        super(message, options);
        this.code = code;
        this.context = context;
        this.name = 'SenarsError';
    }
    /** Enrich an unknown thrown value with operation context, preserving the cause (E4). */
    static wrap(error, context, code = 'OPERATION_ERROR') {
        if (error instanceof SenarsError) {
            return new SenarsError(error.message, error.code, { ...error.context, ...context }, {
                cause: error,
            });
        }
        const message = errMsg(error);
        return new SenarsError(message, code, context, {
            cause: error instanceof Error ? error : undefined,
        });
    }
    /** Safe JSON serialization for MCP error responses. */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            context: this.context,
            stack: this.stack,
        };
    }
}
/** Retryable error codes — errors with these codes should be retried with backoff. */
export const RETRYABLE_ERROR_CODES = new Set([
    'TRANSPORT_ERROR',
    'CONNECTION_ERROR',
    'TIMEOUT',
    'UNAVAILABLE',
    'LM_UNAVAILABLE',
    'SANDBOX_TIMEOUT',
]);
/** Check if an error (any type) is retryable based on its code (for SenarsError) or message fallback. */
export function isRetryableError(error) {
    if (error instanceof SenarsError) {
        return RETRYABLE_ERROR_CODES.has(error.code);
    }
    // Fallback for non-SenarsError: message-based heuristic (legacy compatibility)
    const msg = errMsg(error).toLowerCase();
    return (/\b(fetch|network|econn|timeout|aborted|socket|rate.?limit|5\d\d)\b/.test(msg) ||
        /failed to (fetch|connect)/.test(msg));
}
/**
 * The one subclass shape in the taxonomy: a `name`, an {@link ErrorCode}, and the
 * `(message, context, cause)` arguments all of them accepted.
 *
 * Eight classes had that constructor written out in full, so a code added to the
 * union above cost a file per code and every one of those files had to remember
 * to thread `options` through — three of them did not, so an error raised through
 * them silently dropped its cause. The taxonomy is now one declaration per code,
 * and cause threading is not optional.
 *
 * Returns the constructor only; a caller that names the instance type pairs it
 * with `export type X = InstanceType<typeof X>`.
 */
export const codedError = (name, code) => {
    const CodedError = class extends SenarsError {
        constructor(message, context, options) {
            super(message, code, context, options);
            this.name = name;
        }
    };
    // The class expression can only be named once, so it shares a name with every
    // other declaration from this factory. `constructor.name` is load-bearing — it
    // is what a stack frame and a test assert against — so each code claims it.
    Object.defineProperty(CodedError, 'name', { value: name });
    return CodedError;
};
