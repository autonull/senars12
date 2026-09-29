import { LruCache } from '@senars/util';

/**
 * In-flight requests cap. The keys are utterances arriving on an untrusted
 * input surface, so the map is bounded like every other unbounded-input map in
 * the NAR: past the cap the oldest in-flight key is dropped, and a duplicate
 * of it re-issues rather than joining. Deduplication stays best-effort; the
 * request it guards is the caller's to own.
 */
const DEFAULT_MAX_INFLIGHT = 256;

export class SingleFlight {
  private readonly inflight: LruCache<string, Promise<unknown>>;

  constructor(options: { maxInflight?: number } = {}) {
    this.inflight = new LruCache({ maxSize: options.maxInflight ?? DEFAULT_MAX_INFLIGHT });
  }

  run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;
    const p = fn().finally(() => {
      if (this.inflight.get(key) === p) this.inflight.delete(key);
    });
    this.inflight.set(key, p);
    return p;
  }

  get size(): number {
    return this.inflight.size;
  }
}
