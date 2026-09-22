import type { LMTask } from '@senars/util';

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  value: string;
  expiresAt: number;
}

function hashKey(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

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
  return hashKey(parts.join('|'));
}

/** Prompt-hash-keyed semantic cache with 60s TTL. Cleared on failure so retries
 *  re-populate. D16: bounded memory without a timer — each write sweeps expired entries. */
export class ResponseCache {
  private cache = new Map<string, CacheEntry>();

  get(key: string): string | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: string): void {
    const now = Date.now();
    if (this.cache.size > 0) {
      for (const [k, entry] of this.cache) {
        if (now > entry.expiresAt) this.cache.delete(k);
      }
    }
    this.cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
  }

  clear(key: string): void {
    this.cache.delete(key);
  }
}
