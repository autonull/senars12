/**
 * Retry with exponential backoff — the single delay policy behind the LM
 * transport and the io connection layers.
 */
import { sleep } from './async';
/** Exponential backoff delay for a 0-based attempt number, capped at `maxMs`. */
const backoffDelay = (attempt, baseMs, maxMs) => Math.min(baseMs * 2 ** attempt, maxMs);
/** Retry `fn` with exponential backoff; rethrows the last failure. */
export async function withRetry(fn, options = {}) {
    const { retries = 2, baseMs = 100, maxMs = 1000, isRetryable, onRetry, signal, mapError, } = options;
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt === retries || (isRetryable && !isRetryable(error)))
                throw mapError ? mapError(error) : error;
            const delay = backoffDelay(attempt, baseMs, maxMs);
            onRetry?.(error, attempt, delay);
            if (signal?.aborted)
                throw error;
            await sleep(delay);
        }
    }
    throw mapError ? mapError(lastError) : lastError;
}
