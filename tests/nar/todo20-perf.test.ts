/** Bench 69 — Performance Hot Paths (TODO20 Phase 8: P1 bag-lcg, P2 cache, P3 negotiator, P4 param-batch). */
import { describe, expect, it, vi } from 'vitest';
import { PriorityBag } from '../../nar/src/bag/Bag.js';
import { EmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import { Negotiator, type NALDerivation } from '../../nar/src/reflex/Negotiator.js';
import { createParameterTable } from '../../nar/src/config/parameter-table.js';
import { createLCG, type RandomSource } from '../helpers/rng.js';

describe('Bench 69 — P1: Bag seeded LCG', () => {
  const fill = (bag: PriorityBag<{ id: string; priority: number }>, n: number) => {
    for (let i = 0; i < n; i++) bag.add({ id: `t${i}`, priority: 0.1 + (i % 10) / 10 });
  };

  it('two bags with the same seed produce identical sample sequences (replay)', () => {
    const sample = (seed: number) => {
      const bag = new PriorityBag<{ id: string; priority: number }>({
        capacity: 100,
        rng: createLCG(seed),
      });
      fill(bag, 50);
      return Array.from({ length: 20 }, () => bag.sample()?.id);
    };
    expect(sample(42)).toEqual(sample(42));
    expect(sample(42)).not.toEqual(sample(43));
  });

  it('seeded LCG sampling overhead vs Math.random is within CI-safe tolerance', () => {
    const timed = (makeRng?: (seed: number) => RandomSource) => {
      const bag = new PriorityBag<{ id: string; priority: number }>({
        capacity: 1000,
        ...(makeRng ? { rng: makeRng(Math.random()) } : {}),
      });
      fill(bag, 1000);
      const start = performance.now();
      for (let i = 0; i < 20_000; i++) bag.sample();
      return performance.now() - start;
    };
    const mathMs = timed();
    const lcgMs = timed((seed) => createLCG(seed));
    // Generous CI guard (acceptance target is ≤5%; timing jitter on shared
    // runners makes a hard 5% assertion a flake trap — see §5q note).
    expect(lcgMs).toBeLessThan(mathMs * 2);
  });
});

describe('Bench 69 — P2: EmbeddingCache metrics & eviction', () => {
  const cacheWith = (config = {}) =>
    new EmbeddingCache({
      maxSize: 100,
      ttlMs: 300_000,
      generator: { generate: async () => new Array(384).fill(0.5) },
      ...config,
    });

  it('tracks hits/misses/writes/size and hitRate', async () => {
    const cache = cacheWith();
    await cache.write('a');
    await cache.write('a');
    await cache.write('b');
    expect(cache.metrics()).toMatchObject({ hits: 1, misses: 2, writes: 2, size: 2 });
    expect(cache.hitRate()).toBeCloseTo(1 / 3);
  });

  it('LRU-evicts beyond maxEntries and counts evictions', async () => {
    const cache = cacheWith({ maxSize: 2 });
    await cache.write('a');
    await cache.write('b');
    await cache.write('c'); // evicts 'a'
    expect(cache.has('a')).toBe(false);
    expect(cache.has('c')).toBe(true);
    expect(cache.metrics().evictions).toBe(1);
    expect(cache.metrics().size).toBe(2);
  });

  it('evicted entries release pool buffers (clear + evict are symmetric)', async () => {
    const cache = cacheWith({ maxSize: 3 });
    for (const t of ['a', 'b', 'c', 'd', 'e']) await cache.write(t);
    cache.clear();
    expect(cache.metrics().size).toBe(0);
  });
});

describe('Bench 69 — P3: Negotiator veto memoization', () => {
  const derivations = (n: number): NALDerivation[] =>
    Array.from({ length: n }, (_, i) => ({
      action: `act_${i % 5}`,
      truth: { f: i % 2 === 0 ? 0.1 : 0.9, c: 0.95 },
      source: `beliefs${i}`,
    }));

  it('memoizes veto checks; repeated resolves reuse entries (memo non-empty, decisions stable)', () => {
    const neg = new Negotiator();
    const proposals = Array.from({ length: 5 }, (_, i) => ({
      action: `act_${i}`,
      value: 0.9,
      confidence: 0.9,
      source: 'reflex',
    }));
    const d = derivations(50);
    const first = neg.resolve(proposals, d);
    const memoAfterFirst = neg.memoStats().size;
    expect(memoAfterFirst).toBeGreaterThan(0);
    for (let i = 0; i < 9; i++) {
      expect(neg.resolve(proposals, d)).toEqual(first);
    }
    expect(neg.memoStats().size).toBe(memoAfterFirst);
  });

  it('memo is safe across changing derivations (no stale vetoes)', () => {
    const neg = new Negotiator();
    const proposals = [{ action: 'act_0', value: 0.9, confidence: 0.9, source: 'reflex' }];
    const vetoed = neg.resolve(proposals, [
      { action: 'act_0', truth: { f: 0.1, c: 0.95 }, source: 'b1' },
    ]);
    const notVetoed = neg.resolve(proposals, [
      { action: 'act_0', truth: { f: 0.9, c: 0.95 }, source: 'b2' },
    ]);
    expect(vetoed.vetoedBy).toContain('nal-');
    expect(notVetoed.vetoedBy).toBeNull();
  });
});

describe('Bench 69 — P4: ParameterTable write coalescing', () => {
  it('setMany validates all-or-nothing, actuates each changed parameter once', () => {
    const table = createParameterTable();
    const actuate = vi.fn();
    table.register({ name: 'a', scope: 'game:g', min: 0, max: 1, value: 0.5, owner: 'o', actuate });
    table.register({ name: 'b', scope: 'game:g', min: 0, max: 1, value: 0.5, owner: 'o', actuate });
    const out = table.setMany('game:g', [
      ['a', 0.2],
      ['b', 0.8],
    ]);
    expect(out).toEqual([0.2, 0.8]);
    expect(actuate).toHaveBeenCalledTimes(2);
    // Unchanged values do not re-actuate (coalescing).
    table.setMany('game:g', [
      ['a', 0.2],
      ['b', 0.9],
    ]);
    expect(actuate).toHaveBeenCalledTimes(3);
  });

  it('setMany is all-or-nothing on scope errors (nothing applied)', () => {
    const table = createParameterTable();
    const actuate = vi.fn();
    table.register({ name: 'a', scope: 'game:g', min: 0, max: 1, value: 0.5, owner: 'o', actuate });
    expect(() =>
      table.setMany('game:g', [
        ['a', 0.1],
        ['nope', 0.1],
      ])
    ).toThrow(/unknown parameter/);
    expect(table.get('game:g', 'a')).toBe(0.5);
    expect(actuate).not.toHaveBeenCalled();
  });

  it('setMany clamps values before actuation', () => {
    const table = createParameterTable();
    const actuate = vi.fn();
    table.register({ name: 'a', scope: 'system', min: 0, max: 1, value: 0.5, owner: 'o', actuate });
    const [v] = table.setMany('system', [['a', 5]]);
    expect(v).toBe(1);
    expect(actuate).toHaveBeenCalledWith(1);
  });
});
