export class TermCache<T = unknown> {
    private cache = new Map<number, T>();
    private maxSize: number;
    private hits = 0;
    private misses = 0;

    constructor(maxSize = 5000) {
        this.maxSize = maxSize;
    }

  get(hash: number): T | undefined {
    const term = this.cache.get(hash);
    if (term !== undefined) {
      this.cache.delete(hash);
      this.cache.set(hash, term);
      this.hits++;
      return term;
    }
    this.misses++;
    return undefined;
  }

  set(term: T & { hash: number }): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(term.hash, term);
  }

  get hitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }

    get size(): number {
        return this.cache.size;
    }

    clear(): void {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }
}
