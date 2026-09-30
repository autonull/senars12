import { LruCache } from '@senars/util';
import { sym } from '../types/ast.js';

export interface InternOptions {
  /** Hard capacity of the intern table. */
  readonly maxSize?: number;
}

/** Bounded, recency-ordered name → symbol intern table (cold names age out). */
export class SymbolInterner implements Disposable {
  readonly #cache: LruCache<string, ReturnType<typeof sym>>;

  constructor(opts: InternOptions = {}) {
    this.#cache = new LruCache({ maxSize: opts.maxSize ?? 10_000 });
  }

  intern(name: string): ReturnType<typeof sym> {
    const cached = this.#cache.get(name);
    if (cached) return cached;
    const symbol = sym(name);
    this.#cache.set(name, symbol);
    return symbol;
  }

  get(name: string): ReturnType<typeof sym> | undefined {
    return this.#cache.get(name);
  }

  has(name: string): boolean {
    return this.#cache.has(name);
  }

  clear(): void {
    this.#cache.clear();
  }

  [Symbol.dispose](): void {
    this.#cache.clear();
  }
}
