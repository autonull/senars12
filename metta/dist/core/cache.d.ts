export type EvictionPolicy = 'lru' | 'lfu' | 'fifo' | 'ttl' | 'weak';
export interface CacheOptions<V> {
  readonly maxSize?: number;
  readonly ttl?: number;
  readonly policy?: EvictionPolicy;
  readonly weakRefs?: boolean;
  readonly onEvict?: (key: string, value: V) => void;
  readonly onHit?: (key: string) => void;
  readonly onMiss?: (key: string) => void;
}
export interface CacheStats {
  readonly hits: number;
  readonly misses: number;
  readonly size: number;
  readonly evictions: number;
  readonly hitRate: number;
}
export declare class Cache<V> implements Disposable {
  private readonly opts;
  private impl;
  constructor(opts?: CacheOptions<V>);
  get(key: string): V | undefined;
  set(key: string, value: V): void;
  has(key: string): boolean;
  clear(): void;
  getStats(): CacheStats;
  [Symbol.dispose](): void;
}
//# sourceMappingURL=cache.d.ts.map
