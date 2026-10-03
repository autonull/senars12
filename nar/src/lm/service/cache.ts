import { type Clock, djb2, type LMTask, LruCache } from '@senars/util';

const CACHE_TTL_MS = 60_000;

export function buildCacheKey(
  prompt: string,
  options?: {
    task?: LMTask;
    temperature?: number;
    maxOutputTokens?: number;
    grammar?: string;
    model?: string;
  }
): string {
  const parts = [
    prompt,
    options?.task ?? 'fast',
    options?.temperature ?? 0,
    options?.maxOutputTokens ?? 0,
    options?.grammar ?? '',
    options?.model ?? '',
  ];
  return djb2(parts.join('|')).toString(36);
}

/** Prompt-hash-keyed semantic cache with 60s TTL. Cleared on failure so retries
 *  re-populate. D16: bounded memory without a timer — each write sweeps expired entries. */
export class ResponseCache {
  readonly #cache: LruCache<string, string>;

  constructor(opts: { ttlMs?: number; now?: Clock } = {}) {
    this.#cache = new LruCache<string, string>({
      ttlMs: opts.ttlMs ?? CACHE_TTL_MS,
      now: opts.now,
    });
  }

  /** Live (unexpired) entries — the bound the sweep maintains. */
  get size(): number {
    return this.#cache.size();
  }

  get(key: string): string | undefined {
    return this.#cache.get(key);
  }

  set(key: string, value: string): void {
    this.#cache.purgeExpired();
    this.#cache.set(key, value);
  }

  clear(key: string): void {
    this.#cache.delete(key);
  }
}
