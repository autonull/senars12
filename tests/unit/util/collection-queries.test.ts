import { collectUpTo, joinKey, shareOf, splitKey } from '@senars/util';
import { describe, expect, it } from 'vitest';

describe('collectUpTo', () => {
  it('admits what the predicate accepts and stops at the limit', () => {
    const keep = (n: number) => (n % 2 === 0 ? n : undefined);
    expect(collectUpTo([1, 2, 3, 4, 5, 6], 2, keep)).toEqual([2, 4]);
  });

  it('projects as it collects, so the scan need not build the answer twice', () => {
    const words = ['alpha', 'beta', 'gamma'];
    expect(collectUpTo(words, 2, (w) => w.length)).toEqual([5, 4]);
  });

  it('collects nothing for a limit of zero or below, without scanning', () => {
    let visited = 0;
    const counted = collectUpTo([1, 2, 3], 0, (n) => {
      visited++;
      return n;
    });
    expect(counted).toEqual([]);
    expect(visited).toBe(0);
  });

  it('bounds the scan by the admitted count, not by the source length', () => {
    // Ten thousand rejects then one admit: the limit is about the answer's size,
    // so the cost of producing it must not scale with the size of the input.
    const source = [...Array(10_000).keys(), 99_999];
    expect(collectUpTo(source, 1, (n) => (n === 99_999 ? n : undefined))).toEqual([99_999]);
  });

  it('returns an empty list rather than null when nothing is admitted', () => {
    expect(collectUpTo([1, 2, 3], 5, () => undefined)).toEqual([]);
  });
});

describe('shareOf', () => {
  const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('takes a ceiling-rounded share', () => {
    expect(shareOf(pool, 0.3)).toEqual([1, 2, 3]);
    expect(shareOf(pool, 0.25)).toEqual([1, 2, 3]);
  });

  it('never takes more than the pool holds', () => {
    expect(shareOf(pool, 2)).toEqual(pool);
    expect(shareOf(pool, 1)).toEqual(pool);
  });

  it('takes none of a zero share', () => {
    expect(shareOf(pool, 0)).toEqual([]);
  });

  it('honours a floor of one for a pool too small for any share', () => {
    expect(shareOf(pool, 0, 1)).toEqual([1]);
    expect(shareOf(pool, 0.5, 8)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('is empty for an empty pool whatever the share', () => {
    expect(shareOf([], 0.5, 3)).toEqual([]);
  });
});

describe('joinKey / splitKey', () => {
  it('round-trips a composite key', () => {
    const key = joinKey('derivations', 'maxDepth');
    expect(key).toBe('derivations::maxDepth');
    expect(splitKey(key, 2)).toEqual(['derivations', 'maxDepth']);
    expect(splitKey(joinKey('a', 'b', 'c'), 3)).toEqual(['a', 'b', 'c']);
  });

  it('refuses a part that itself contains the separator, rather than splitting inside it', () => {
    // The pair is a split, not a quote: a separator inside a part makes the key
    // unparseable, and the arity check is what says so.
    expect(() => splitKey(joinKey('ns::sub', 'name'), 2)).toThrow(/3 parts, expected 2/);
  });

  it('refuses a key of the wrong arity rather than returning undefined parts', () => {
    expect(() => splitKey('a::b', 3)).toThrow(/2 parts, expected 3/);
    expect(() => splitKey('a', 2)).toThrow(/1 part/);
  });
});