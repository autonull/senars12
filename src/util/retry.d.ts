/**
 * Retry with exponential backoff — the single delay policy behind the LM
 * transport and the io connection layers.
 */
export interface RetryOptions {
    /** Retries *after* the first attempt. */
    retries?: number;
    baseMs?: number;
    maxMs?: number;
    /** Only retryable failures are retried; everything else rethrows immediately. */
    isRetryable?: (error: unknown) => boolean;
    onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
    signal?: AbortSignal;
    /** Translate the final failure into a domain error (LM unavailability, …). */
    mapError?: (error: unknown) => Error;
}
/** Retry `fn` with exponential backoff; rethrows the last failure. */
export declare function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
//# sourceMappingURL=retry.d.ts.map