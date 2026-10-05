import {
  accumulate,
  BoundedRing,
  buckets,
  getOrInsert,
  groupBy,
  insertByScoreDesc,
  keyedBy,
  mapToRecord,
  mapValues,
  maxBy,
  minBy,
  rankBy,
  removeBy,
  sortBy,
  sumBy,
  uniqueBy,
} from '@senars/util';
import { describe, expect, it } from 'vitest';

describe('accumulate', () => {
  it('mints the record once and adds to it thereafter', () => {
    const totals = new Map<string, { calls: number; tokens: number }>();
    const zero = () => ({ calls: 0, tokens: 0 });

    accumulate(totals, 'a', zero, (e) => {
      e.calls++;
      e.tokens += 5;
    });
    accumulate(totals, 'a', zero, (e) => {
      e.calls++;
      e.tokens += 7;
    });

    expect(totals.get('a')).toEqual({ calls: 2, tokens: 12 });
  });

  it('returns the stored record, so the running total needs no third lookup', () => {
    const running = new Map<string, { total: number }>();
    accumulate(
      running,
      'a',
      () => ({ total: 0 }),
      (e) => {
        e.total += 10;
      }
    );
    const after = accumulate(
      running,
      'a',
      () => ({ total: 0 }),
      (e) => {
        e.total += 10;
      }
    );
    expect(after).toEqual({ total: 20 });
    expect(after).toBe(running.get('a'));
  });

  it('keeps keys independent', () => {
    const totals = new Map<string, { n: number }>();
    accumulate(
      totals,
      'a',
      () => ({ n: 0 }),
      (e) => {
        e.n++;
      }
    );
    accumulate(
      totals,
      'b',
      () => ({ n: 0 }),
      (e) => {
        e.n += 100;
      }
    );
    expect([...totals]).toEqual([
      ['a', { n: 1 }],
      ['b', { n: 100 }],
    ]);
  });

  it('accumulates over the same store getOrInsert populates', () => {
    const store = new Map<string, { n: number }>();
    getOrInsert(store, 'a', () => ({ n: 0 }));
    accumulate(
      store,
      'a',
      () => ({ n: 0 }),
      (e) => {
        e.n++;
      }
    );
    expect(store.get('a')).toEqual({ n: 1 });
  });
});

describe('uniqueBy', () => {
  it('keeps the first item per key, in encounter order', () => {
    expect(
      uniqueBy(
        [
          { id: 'a', v: 1 },
          { id: 'b', v: 2 },
          { id: 'a', v: 3 },
        ],
        (r) => r.id
      )
    ).toEqual([
      { id: 'a', v: 1 },
      { id: 'b', v: 2 },
    ]);
  });

  it('evaluates the key once per item', () => {
    let calls = 0;
    uniqueBy([1, 2, 3, 4], (n) => {
      calls++;
      return n % 2;
    });
    expect(calls).toBe(4);
  });

  it('is empty-preserving and dedupes nothing it should not', () => {
    expect(uniqueBy([], String)).toEqual([]);
    expect(uniqueBy([3, 1, 2], (n) => n)).toEqual([3, 1, 2]);
  });
});

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

describe('sortBy / rankBy', () => {
  it('sort ascending and descending without mutating the input', () => {
    const input = [3, 1, 2];
    expect(sortBy(input, (n) => n)).toEqual([1, 2, 3]);
    expect(rankBy(input, (n) => n)).toEqual([3, 2, 1]);
    expect(input).toEqual([3, 1, 2]);
  });

  it('accepts any iterable', () => {
    expect(rankBy(new Set([1, 4, 2]), (n) => n)).toEqual([4, 2, 1]);
  });

  it('keeps tied items in input order, so no index decoration is needed', () => {
    const tagged = [1, 2, 3].map((key) => ({ key, score: 5 }));
    expect(rankBy(tagged, (t) => t.score).map((t) => t.key)).toEqual([1, 2, 3]);
  });

  it('computes the key once per item', () => {
    const seen: number[] = [];
    rankBy([3, 1, 2], (n) => {
      seen.push(n);
      return n;
    });
    expect(seen.sort()).toEqual([1, 2, 3]);
  });

  describe('where / tiebreak / limit', () => {
    const scored = [
      { id: 'c', score: 1 },
      { id: 'a', score: 5 },
      { id: 'b', score: 5 },
      { id: 'd', score: 9 },
    ];

    it('drops below the floor before ranking, reusing the computed key', () => {
      expect(
        rankBy(scored, (r) => r.score, { where: (_r, key) => key >= 5 }).map((r) => r.id)
      ).toEqual(['d', 'a', 'b']);
    });

    it('breaks ties by name rather than input order, falling back to it otherwise', () => {
      const byId = (a: (typeof scored)[number], b: (typeof scored)[number]): number =>
        a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

      expect(rankBy(scored, (r) => r.score, { tiebreak: byId }).map((r) => r.id)).toEqual([
        'd',
        'a',
        'b',
        'c',
      ]);
    });

    it('caps the ranked result, and treats a non-positive limit as none', () => {
      expect(rankBy(scored, (r) => r.score, { limit: 2 }).map((r) => r.id)).toEqual(['d', 'a']);
      expect(rankBy(scored, (r) => r.score, { limit: 0 })).toEqual([]);
      expect(rankBy(scored, (r) => r.score, { limit: -1 })).toEqual([]);
    });
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
    const [firstBucket] = buckets(
      [
        { k: 1, n: 'a' },
        { k: 1, n: 'b' },
      ],
      (r) => r.k
    );
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
    expect(
      keyedBy(
        [{ id: 'a', n: 2 }],
        (r) => r.id,
        (r) => r.n
      )
    ).toEqual({ a: 2 });
  });

  it('keeps the last occurrence, as the `Object.fromEntries` copy it replaces did', () => {
    expect(
      keyedBy(
        [
          { id: 'a', n: 1 },
          { id: 'a', n: 2 },
        ],
        (r) => r.id,
        (r) => r.n
      )
    ).toEqual({
      a: 2,
    });
  });

  it('agrees with the `Object.fromEntries` copy on unique keys', () => {
    const items = [
      { id: 'x', n: 1 },
      { id: 'y', n: 2 },
    ];
    expect(
      keyedBy(
        items,
        (r) => r.id,
        (r) => r.n
      )
    ).toEqual(Object.fromEntries(items.map((r) => [r.id, r.n])));
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
    expect(
      mapToRecord(
        new Map([
          ['a', 1],
          ['b', 2],
        ]),
        (value, key) => `${key}${value}`
      )
    ).toEqual({
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

describe('BoundedRing overflow policy', () => {
  it('drops the oldest past capacity, and says which one it dropped', () => {
    const ring = new BoundedRing<number>(2);
    expect(ring.push(1)).toBeUndefined();
    expect(ring.push(2)).toBeUndefined();
    expect(ring.push(3)).toBe(1);
    expect([...ring]).toEqual([2, 3]);
  });

  it('refuses the newcomer past capacity, and hands back the refused item', () => {
    const ring = new BoundedRing<number>(2, 'refuse');
    expect(ring.push(1)).toBeUndefined();
    expect(ring.push(2)).toBeUndefined();
    // The item that did *not* stay is the one offered, not the oldest — which is
    // what makes a refused send recoverable instead of a silently lost request.
    expect(ring.push(3)).toBe(3);
    expect([...ring]).toEqual([1, 2]);
  });

  it('tryPush admits under eviction and refuses under the refusing policy', () => {
    const evicting = new BoundedRing<number>(1);
    expect(evicting.tryPush(1)).toBe(true);
    // Always admitted: the eviction policy pays with a neighbour, not the caller.
    expect(evicting.tryPush(2)).toBe(true);
    expect([...evicting]).toEqual([2]);

    const refusing = new BoundedRing<number>(1, 'refuse');
    expect(refusing.tryPush(1)).toBe(true);
    expect(refusing.tryPush(2)).toBe(false);
    expect([...refusing]).toEqual([1]);
  });

  it('reports occupancy either way, so a refusing queue is not invisible', () => {
    const ring = new BoundedRing<number>(2, 'refuse');
    expect(ring.pressure()).toBe(0);
    ring.tryPush(1);
    expect(ring.pressure()).toBe(0.5);
    ring.tryPush(2);
    expect(ring.pressure()).toBe(1);
    expect(ring.tryPush(3)).toBe(false);
    expect(ring.pressure()).toBe(1);
  });

  it('rejects a capacity below one under either policy', () => {
    expect(() => new BoundedRing<number>(0)).toThrow(RangeError);
    expect(() => new BoundedRing<number>(0, 'refuse')).toThrow(RangeError);
  });
});
