import {
  BoundedRing,
  buckets,
  groupBy,
  insertByScoreDesc,
  keyedBy,
  mapToRecord,
  mapValues,
  maxBy,
  minBy,
  removeBy,
  sortBy,
  sortByDesc,
} from '@senars/util';
import { sumBy } from '@senars/util';
import { describe, expect, it } from 'vitest';

describe('removeBy', () => {
  const items = () => ['a', 'b', 'c'];

  it('returns the entry it removed', () => {
    const list = items();
    expect(removeBy(list, (item) => item === 'b')).toBe('b');
    expect(list).toEqual(['a', 'c']);
  });

  it('removes only the first match', () => {
    const list = ['a', 'b', 'b'];
    expect(removeBy(list, (item) => item === 'b')).toBe('b');
    expect(list).toEqual(['a', 'b']);
  });

  it('leaves the array untouched when nothing matches', () => {
    // The hand-written `findIndex`-then-`splice` pair this replaces reported a
    // miss *after* mutating, and `splice(-1, 1)` removes the last entry — so the
    // one caller that needed the removed item deleted an unrelated one instead.
    const list = items();
    expect(removeBy(list, (item) => item === 'zzz')).toBeUndefined();
    expect(list).toEqual(['a', 'b', 'c']);
  });

  it('handles a falsy element, so a match is not lost to a truthiness check', () => {
    const list = [0, 1, 2];
    expect(removeBy(list, (n) => n === 0)).toBe(0);
    expect(list).toEqual([1, 2]);
  });

  it('agrees with splice on an empty array', () => {
    const list: string[] = [];
    expect(removeBy(list, () => true)).toBeUndefined();
    expect(list).toEqual([]);
  });
});

describe('minBy', () => {
  it('picks the lowest-scored item', () => {
    expect(minBy([{ n: 3 }, { n: 1 }, { n: 2 }], (i) => i.n)).toEqual({ n: 1 });
  });

  it('returns undefined for an empty collection', () => {
    expect(minBy([], () => 0)).toBeUndefined();
  });
});

describe('maxBy', () => {
  it('picks the highest-scored item', () => {
    expect(maxBy([{ n: 3 }, { n: 9 }, { n: 2 }], (i) => i.n)).toEqual({ n: 9 });
  });

  it('handles negative-only scores', () => {
    expect(maxBy([-5, -9], (n) => n)).toBe(-5);
  });
});

describe('sortBy / sortByDesc', () => {
  it('sort ascending and descending without mutating the input', () => {
    const input = [3, 1, 2];
    expect(sortBy(input, (n) => n)).toEqual([1, 2, 3]);
    expect(sortByDesc(input, (n) => n)).toEqual([3, 2, 1]);
    expect(input).toEqual([3, 1, 2]);
  });

  it('accepts any iterable', () => {
    expect(sortByDesc(new Set([1, 4, 2]), (n) => n)).toEqual([4, 2, 1]);
  });
});

describe('insertByScoreDesc', () => {
  const score = (i: { n: number }) => i.n;

  it('keeps the list descending as items arrive out of order', () => {
    const items: { n: number }[] = [];
    for (const n of [3, 9, 1, 5, 9]) insertByScoreDesc(items, { n }, score);
    expect(items.map(score)).toEqual([9, 9, 5, 3, 1]);
  });

  it('appends when the item scores lowest', () => {
    const items = [{ n: 5 }, { n: 2 }];
    insertByScoreDesc(items, { n: 0 }, score);
    expect(items.map(score)).toEqual([5, 2, 0]);
  });

  it('prepends when the item scores highest', () => {
    const items = [{ n: 5 }, { n: 2 }];
    insertByScoreDesc(items, { n: 7 }, score);
    expect(items.map(score)).toEqual([7, 5, 2]);
  });

  it('agrees with a full sort on mixed input', () => {
    const input = [4, 1, 8, 8, 2, 9, 3];
    const items: { n: number }[] = [];
    for (const n of input) insertByScoreDesc(items, { n }, score);
    expect(items.map(score)).toEqual([...input].sort((a, b) => b - a));
  });
});

describe('groupBy', () => {
  const rows = [
    { head: 'task_type', score: 0.9 },
    { head: 'risk', score: 0.2 },
    { head: 'task_type', score: 0.4 },
  ];

  it('buckets by the derived key, preserving encounter order within a bucket', () => {
    const buckets = groupBy(rows, (row) => row.head);
    expect([...buckets.keys()]).toEqual(['task_type', 'risk']);
    expect(buckets.get('task_type')).toEqual([rows[0], rows[2]]);
    expect(buckets.get('risk')).toEqual([rows[1]]);
  });

  it('omits a key nothing mapped to, rather than handing back an empty bucket', () => {
    expect(groupBy(rows, (row) => row.head).has('tense')).toBe(false);
  });

  it('agrees with a hand-rolled bucket loop', () => {
    const expected = new Map<string, typeof rows>();
    for (const row of rows) {
      const bucket = expected.get(row.head);
      if (bucket) bucket.push(row);
      else expected.set(row.head, [row]);
    }
    expect(groupBy(rows, (row) => row.head)).toEqual(expected);
  });

  it('returns an empty map for an empty input', () => {
    expect(groupBy([], (n: number) => n).size).toBe(0);
  });
});

describe('buckets', () => {
  it('drops the keys and keeps each bucket, so a caller that never looks up by key need not retain a map', () => {
    const grouped = buckets(['aa', 'b', 'ab'], (s) => s.length);
    expect(grouped.map((bucket) => bucket.sort())).toEqual([['aa', 'ab'], ['b']]);
  });

  it('exposes the first item seen for a key as the bucket head', () => {
    const [firstBucket] = buckets([{ k: 1, n: 'a' }, { k: 1, n: 'b' }], (r) => r.k);
    expect(firstBucket?.[0]?.n).toBe('a');
  });
});

describe('keyedBy', () => {
  it('indexes by the derived key with the item as its own value', () => {
    expect(keyedBy([{ id: 'a' }, { id: 'b' }], (r) => r.id)).toEqual({
      a: { id: 'a' },
      b: { id: 'b' },
    });
  });

  it('projects the value without a second pass', () => {
    expect(keyedBy([{ id: 'a', n: 2 }], (r) => r.id, (r) => r.n)).toEqual({ a: 2 });
  });

  it('keeps the last occurrence, as the `Object.fromEntries` copy it replaces did', () => {
    expect(keyedBy([{ id: 'a', n: 1 }, { id: 'a', n: 2 }], (r) => r.id, (r) => r.n)).toEqual({
      a: 2,
    });
  });

  it('agrees with the `Object.fromEntries` copy on unique keys', () => {
    const items = [{ id: 'x', n: 1 }, { id: 'y', n: 2 }];
    expect(keyedBy(items, (r) => r.id, (r) => r.n)).toEqual(
      Object.fromEntries(items.map((r) => [r.id, r.n]))
    );
  });
});

describe('mapToRecord', () => {
  it('carries a map across to the plain object an API that speaks Record wants', () => {
    const source = new Map([
      ['L0', { calls: 2, totalMs: 10 }],
      ['L1', { calls: 4, totalMs: 40 }],
    ]);
    expect(mapToRecord(source, (s) => s.totalMs / s.calls)).toEqual({ L0: 5, L1: 10 });
  });

  it('passes the key to the projection', () => {
    expect(mapToRecord(new Map([['a', 1], ['b', 2]]), (value, key) => `${key}${value}`)).toEqual({
      a: 'a1',
      b: 'b2',
    });
  });

  it('keeps values untouched when given no projection', () => {
    expect(mapToRecord(new Map([['a', { n: 1 }]]))).toEqual({ a: { n: 1 } });
  });
});

describe('mapValues', () => {
  it('re-keys nothing and changes only the values', () => {
    const record = { a: { state: 'closed', failures: 0 }, b: { state: 'open', failures: 3 } };
    expect(mapValues(record, (v) => `${v.state}:${v.failures}`)).toEqual({
      a: 'closed:0',
      b: 'open:3',
    });
  });

  it('passes the key to the projection', () => {
    expect(mapValues({ a: 2, b: 3 }, (value, key) => `${key}=${value}`)).toEqual({
      a: 'a=2',
      b: 'b=3',
    });
  });

  it('leaves the input record untouched', () => {
    const record = { a: 1 };
    mapValues(record, (n) => n + 1);
    expect(record).toEqual({ a: 1 });
  });
});

describe('BoundedRing iteration', () => {
  it('yields oldest first, live, so the collection primitives accept a ring', () => {
    const ring = new BoundedRing<number>(3);
    for (const n of [1, 2, 3, 4]) ring.push(n);
    expect([...ring]).toEqual([2, 3, 4]);
  });

  it('is accepted anywhere an Iterable is, which is the point of it', () => {
    const ring = new BoundedRing<{ n: number }>(8);
    for (const n of [{ n: 1 }, { n: 2 }, { n: 3 }]) ring.push(n);
    expect(sumBy(ring, (r) => r.n)).toBe(6);
    expect(groupBy(ring, (r) => r.n % 2).get(1)).toEqual([{ n: 1 }, { n: 3 }]);
  });
});
