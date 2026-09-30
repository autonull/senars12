import { isDeepStrictEqual } from 'node:util';
import { deepEqual, stableStringify } from '@senars/util';
import { describe, expect, it } from 'vitest';
import {
  holdoutSplit,
  mulberry32,
  SeededRNG,
  seededStream,
} from '../../../nar/src/utils/random.js';

describe('stableStringify', () => {
  it('is independent of key insertion order', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
    expect(stableStringify({ a: { d: 1, c: 2 } })).toBe(stableStringify({ a: { c: 2, d: 1 } }));
  });

  it('preserves array order and agrees with JSON.stringify on scalars', () => {
    expect(stableStringify([1, 2, 3])).toBe(JSON.stringify([1, 2, 3]));
    expect(stableStringify([2, 1])).not.toBe(stableStringify([1, 2]));
    expect(stableStringify('x')).toBe('"x"');
    expect(stableStringify(4)).toBe('4');
    expect(stableStringify(null)).toBe('null');
    expect(stableStringify(undefined)).toBe('null');
  });

  it('drops undefined members and serializes typed arrays by value', () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe('{"a":1}');
    expect(stableStringify(new Float32Array([0.5, 1.5]))).toBe('[0.5,1.5]');
  });
});

describe('deepEqual', () => {
  it('ignores key order and respects value and array order', () => {
    expect(deepEqual({ a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });

  it('matches deepStrictEqual on nested structures', () => {
    const cases: [unknown, unknown][] = [
      [{ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }],
      [{ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] }],
      [new Float32Array([1, 2]), new Float32Array([1, 2])],
      [new Float32Array([1, 2]), new Float32Array([2, 1])],
    ];
    for (const [a, b] of cases) {
      expect(deepEqual(a, b)).toBe(isDeepStrictEqual(a, b));
    }
  });

  it('treats an undefined member as absent, as the digest it replaced did', () => {
    expect(deepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(true);
    expect(deepEqual({ a: 1, b: undefined }, { a: 1, b: 2 })).toBe(false);
  });

  it('separates the container kinds the digest encoded differently', () => {
    expect(deepEqual({ 0: 'a', length: 1 }, ['a'])).toBe(false);
    expect(deepEqual([], {})).toBe(false);
    expect(deepEqual([1], new Float32Array([1]))).toBe(false);
    expect(deepEqual([1], new Float32Array([1, 2]))).toBe(false);
  });

  it('rejects differing key sets of the same size', () => {
    expect(deepEqual({ a: 1, b: 2 }, { a: 1, c: 2 })).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});

describe('holdoutSplit', () => {
  const items = Array.from({ length: 20 }, (_, i) => i);

  it('partitions deterministically with the requested holdout size', () => {
    const { holdout, train } = holdoutSplit(items, 0.25, mulberry32(7));
    expect(holdout).toHaveLength(5);
    expect(train).toHaveLength(15);
    expect([...holdout, ...train].sort((a, b) => a - b)).toEqual(items);
  });

  it('is reproducible for a given seed and varies across seeds', () => {
    const a = holdoutSplit(items, 0.2, mulberry32(1));
    const b = holdoutSplit(items, 0.2, mulberry32(1));
    const c = holdoutSplit(items, 0.2, mulberry32(2));
    expect(a).toEqual(b);
    expect(a.holdout).not.toEqual(c.holdout);
  });

  it('always reserves at least one holdout row', () => {
    const { holdout, train } = holdoutSplit([1, 2, 3, 4], 0.01, mulberry32(3));
    expect(holdout).toHaveLength(1);
    expect(train).toHaveLength(3);
  });

  it('does not mutate its input', () => {
    const input = [...items];
    holdoutSplit(input, 0.5, mulberry32(5));
    expect(input).toEqual(items);
  });
});

describe('seededStream', () => {
  const draw = (seed: number, count: number): number[] => {
    const { next } = seededStream(seed);
    return Array.from({ length: count }, next);
  };

  it('is one PRNG: mulberry32 and the stream draw the identical sequence', () => {
    expect(draw(42, 8)).toEqual(Array.from({ length: 8 }, mulberry32(42)));
  });

  it('emits a uniform [0, 1) sample from a given seed', () => {
    const draws = draw(9, 4096);
    expect(draws.every((d) => d >= 0 && d < 1)).toBe(true);
    const mean = draws.reduce((a, b) => a + b, 0) / draws.length;
    expect(Math.abs(mean - 0.5)).toBeLessThan(0.02);
  });

  it('reports a state word that resumes the stream exactly where it left off', () => {
    const stream = seededStream(3);
    stream.next();
    stream.next();
    const checkpoint = stream.state();

    const tail = Array.from({ length: 5 }, seededStream(checkpoint).next);
    expect(draw(3, 7).slice(2)).toEqual(tail);
  });
});

describe('SeededRNG', () => {
  it('round-trips a checkpoint mid-stream', () => {
    const rng = new SeededRNG(17);
    const prefix = Array.from({ length: 6 }, () => rng.next());
    const checkpoint = rng.getState();
    const tail = Array.from({ length: 6 }, () => rng.next());

    rng.setState(checkpoint);
    expect(Array.from({ length: 6 }, () => rng.next())).toEqual(tail);
    expect(Array.from({ length: 6 }, () => rng.next())).not.toEqual(prefix);
  });

  it('exposes the same stream through next, source, and the free helpers', () => {
    const a = new SeededRNG(5);
    const b = new SeededRNG(5);
    expect(Array.from({ length: 4 }, a.source)).toEqual(Array.from({ length: 4 }, b.next));
  });

  it('draws integers in range and rejects empty choice', () => {
    const rng = new SeededRNG(2);
    for (let i = 0; i < 500; i++) {
      const n = rng.nextInt(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
    expect(() => rng.choice([])).toThrow(RangeError);
  });
});
