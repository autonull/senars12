import { LruCache } from '@senars/util';

/** Hash-keyed term cache over the shared bounded LRU. */
export class TermCache<T = unknown> {
  readonly #cache: LruCache<number, T>;

  constructor(maxSize = 5000) {
    this.#cache = new LruCache<number, T>({ maxSize });
  }

  get hitRate(): number {
    return this.#cache.hitRate;
  }

  get size(): number {
    return this.#cache.size;
  }

  get(hash: number): T | undefined {
    return this.#cache.get(hash);
  }

  set(term: T & { hash: number }): void {
    this.#cache.set(term.hash, term);
  }

  clear(): void {
    this.#cache.clear();
  }
}
