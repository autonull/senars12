import { sym } from '../types/ast.js';
import { Cache } from './cache.js';

export interface InternOptions {
  readonly weakRefs?: boolean;
}

export class SymbolInterner implements Disposable {
  private readonly cache: Cache<ReturnType<typeof sym>>;

  constructor(opts: InternOptions = {}) {
    this.cache = new Cache({
      weakRefs: opts.weakRefs ?? false,
      policy: 'fifo',
    });
  }

  intern(name: string): ReturnType<typeof sym> {
    const cached = this.cache.get(name);
    if (cached) return cached;

    const symbol = sym(name);
    this.cache.set(name, symbol);
    return symbol;
  }

  get(name: string): ReturnType<typeof sym> | undefined {
    return this.cache.get(name);
  }

  has(name: string): boolean {
    return this.cache.has(name);
  }

  clear(): void {
    this.cache.clear();
  }

  [Symbol.dispose](): void {
    this.cache[Symbol.dispose]();
  }
}
