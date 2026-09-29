import { BoundedMap, LruCache } from '../../../util/src';

describe('BoundedMap', () => {
  it('drops the least-recently-used key past capacity', () => {
    const map = new BoundedMap<string, number>({ maxSize: 2 });

    map.set('a', 1).set('b', 2);
    map.get('a');
    map.set('c', 3);

    expect([...map.keys()]).toEqual(['a', 'c']);
  });

  it('ignores reads when refreshing recency is off', () => {
    const map = new BoundedMap<string, number>({ maxSize: 2, eviction: 'fifo' });

    map.set('a', 1).set('b', 2);
    map.get('a');
    map.set('c', 3);

    expect([...map.keys()]).toEqual(['b', 'c']);
  });

  it('evicts the lowest score of a custom order, breaking ties by insertion', () => {
    const map = new BoundedMap<string, number>({
      maxSize: 2,
      eviction: { by: (score) => score },
    });

    map.set('a', 5).set('b', 5);
    map.set('c', 1);

    expect([...map.keys()]).toEqual(['b', 'c']);
  });

  it('picks a uniform live key for the random order', () => {
    const draws = [0.99, 0];
    let draw = 0;
    const map = new BoundedMap<string, number>({
      maxSize: 3,
      eviction: 'random',
      rng: () => draws[draw++] ?? 0,
    });

    map.set('a', 1).set('b', 2).set('c', 3);
    map.set('d', 4);
    expect([...map.keys()]).toEqual(['a', 'b', 'd']);

    map.set('e', 5);
    expect([...map.keys()]).toEqual(['b', 'd', 'e']);
  });

  it('expires entries on read and on iteration', () => {
    let now = 1000;
    const map = new BoundedMap<string, number>({ maxSize: 4, ttlMs: 100, now: () => now });

    map.set('a', 1);
    now = 1101;

    expect(map.get('a')).toBeUndefined();
    expect(map.has('a')).toBe(false);

    map.set('b', 2);
    now = 1201;
    expect([...map.values()]).toEqual([]);
  });

  it('purges expired entries on demand', () => {
    let now = 1000;
    const map = new BoundedMap<string, number>({ maxSize: 4, ttlMs: 100, now: () => now });

    map.set('a', 1);
    now = 1400;

    expect(map.purgeExpired()).toBe(1);
    expect(map.size).toBe(0);
  });

  it('reports every removal through onEvict except an explicit delete', () => {
    const seen: string[] = [];
    const map = new BoundedMap<string, number>({ maxSize: 1, onEvict: (_v, key) => seen.push(key) });

    map.set('a', 1);
    map.set('b', 2);
    map.delete('a');
    map.clear();

    expect(seen).toEqual(['a', 'b']);
  });

  it('touches recency without reading the value', () => {
    const map = new BoundedMap<string, number>({ maxSize: 2 });

    map.set('a', 1).set('b', 2);
    expect(map.touch('a')).toBe(true);
    expect(map.touch('missing')).toBe(false);
    map.set('c', 3);

    expect([...map.keys()]).toEqual(['a', 'c']);
  });

  it('reports pressure as a fraction of capacity', () => {
    const map = new BoundedMap<string, number>(4);

    expect(map.pressure()).toBe(0);
    map.set('a', 1);
    expect(map.pressure()).toBe(0.25);
  });
});

describe('LruCache', () => {
  it('counts hits and misses and resets them on clear', () => {
    const cache = new LruCache<string, number>(2);
    cache.set('a', 1);

    cache.get('a');
    cache.get('b');
    expect(cache.hitRate).toBe(0.5);

    cache.clear();
    expect(cache.hits).toBe(0);
    expect(cache.misses).toBe(0);
  });

  it('takes a value once', () => {
    const cache = new LruCache<string, number>(2);
    cache.set('a', 1);

    expect(cache.take('a')).toBe(1);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.take('missing')).toBeUndefined();
  });
});
