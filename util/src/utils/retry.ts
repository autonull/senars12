/**
 * Retry with exponential backoff — the single delay policy behind the LM
 * transport and the io connection layers.
 */

import { sleep } from './shared.js';

/** Exponential backoff delay for a 0-based attempt number, capped at `maxMs`. */
const backoffDelay = (attempt: number, baseMs: number, maxMs: number): number =>
  Math.min(baseMs * 2 ** attempt, maxMs);

export interface RetryOptions {
  /** Retries *after* the first attempt. */
  retries?: number;
  baseMs?: number;
  maxMs?: number;
  /** Only retryable failures are retried; everything else rethrows immediately. */
  isRetryable?: (error: unknown) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  signal?: AbortSignal;
}

/** Retry `fn` with exponential backoff; rethrows the last failure. */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { retries = 2, baseMs = 100, maxMs = 1000, isRetryable, onRetry, signal } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries || (isRetryable && !isRetryable(error))) throw error;
      const delay = backoffDelay(attempt, baseMs, maxMs);
      onRetry?.(error, attempt, delay);
      if (signal?.aborted) throw error;
      await sleep(delay);
    }
  }
  throw lastError;
}
