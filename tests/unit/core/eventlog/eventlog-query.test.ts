import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CognitiveEvent, EventLog } from '@senars/core/eventlog';
import { InMemoryEventLog, SqliteEventLog } from '@senars/core/eventlog';
import { MemoryService } from '@senars/core/memory';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const T0 = 1_700_000_000_000;
const TRUTH = { frequency: 0.9, confidence: 0.8 };

const user = (text: string) =>
  ({
    engine: 'nar',
    type: 'input.user',
    payload: { text, source: 'test' },
    correlationId: `cid-${text}`,
  }) as const;

const belief = (text: string) =>
  ({
    engine: 'nar',
    type: 'belief.added',
    payload: { term: text, truth: TRUTH },
    correlationId: `cid-${text}`,
  }) as const;

/** The seed marker each event carries: `payload.text` or `payload.term`. */
const texts = (events: CognitiveEvent[]): string[] =>
  events.map((e) => {
    switch (e.type) {
      case 'belief.added':
        return e.payload.term;
      case 'input.user':
        return e.payload.text;
      default:
        throw new Error(`unseeded event type: ${e.type}`);
    }
  });

/**
 * One query table, run against both implementations. Episodic recall now reads
 * through `query()`, so the two logs must not be able to disagree about what it
 * returns — and they did, on an empty `types` list and on a non-positive cap.
 */
describe.each([
  ['InMemoryEventLog', (): EventLog => new InMemoryEventLog()],
  [
    'SqliteEventLog',
    (): EventLog =>
      new SqliteEventLog({ path: join(mkdtempSync(join(tmpdir(), 'eventlog-query-')), 'e.db') }),
  ],
])('%s.query', (_name, makeLog) => {
  let log: EventLog;

  beforeEach(() => {
    vi.useFakeTimers();
    log = makeLog();
  });

  afterEach(async () => {
    await log.close();
    vi.useRealTimers();
  });

  const seed = async (): Promise<void> => {
    // `append` stamps with `Date.now()`, so without distinct clock readings every
    // event shares one millisecond and a time range has nothing to discriminate.
    for (const [i, event] of [
      user('t0'),
      belief('t1'),
      user('t2'),
      belief('t3'),
      user('t4'),
    ].entries()) {
      vi.setSystemTime(T0 + i * 1000);
      await log.append(event);
    }
    vi.useRealTimers();
  };

  it('keeps the most recent matches under a cap, still in id order', async () => {
    await seed();
    expect(texts(await log.query({ limit: 2 }))).toEqual(['t3', 't4']);
    expect(texts(await log.query({ limit: 99 }))).toHaveLength(5);
  });

  it('caps by matches, not by how far back the scan may look', async () => {
    await seed();
    // A cap is a cap on the result. Scanning forward and stopping at the cap
    // would return the *oldest* match here; the promise is the most recent one.
    expect(texts(await log.query({ types: ['belief.added'], limit: 1 }))).toEqual(['t3']);
    expect(texts(await log.query({ types: ['belief.added'] }))).toEqual(['t1', 't3']);
  });

  it('treats an empty type list as no filter, not as nothing', async () => {
    await seed();
    // sqlite skipped the `IN ()` clause and returned everything; the in-memory
    // filter returned nothing. An allowlist with nothing in it matches nothing —
    // but an *absent* allowlist is not an empty one.
    expect(texts(await log.query({ types: [] }))).toHaveLength(5);
    expect(texts(await log.query({ types: ['input.user'] }))).toHaveLength(3);
  });

  it('filters by correlationId and by an inclusive time range', async () => {
    await seed();
    expect(texts(await log.query({ correlationId: 'cid-t2' }))).toEqual(['t2']);

    const first = (await log.query({}))[0]!.timestamp;
    const last = (await log.query({})).at(-1)!.timestamp;
    expect(texts(await log.query({ timeRange: [first, last] }))).toHaveLength(5);
    // Both ends are inclusive, so a one-millisecond window at either end keeps
    // that event.
    expect(texts(await log.query({ timeRange: [first, first] }))).toEqual(['t0']);
    expect(texts(await log.query({ timeRange: [last, last] }))).toEqual(['t4']);
    expect(texts(await log.query({ timeRange: [first + 1, last] }))).toHaveLength(4);
    expect(texts(await log.query({ timeRange: [first, last - 1] }))).toHaveLength(4);
  });

  it('reads nothing for a non-positive cap rather than everything', async () => {
    await seed();
    expect(texts(await log.query({ limit: 0 }))).toEqual([]);
    expect(texts(await log.query({ limit: -1 }))).toEqual([]);
  });
});

describe('MemoryService.queryEpisodic', () => {
  let log: EventLog;

  beforeEach(() => {
    vi.useFakeTimers();
    log = new InMemoryEventLog();
  });

  afterEach(async () => {
    await log.close();
    vi.useRealTimers();
  });

  const memory = (): MemoryService => {
    const service = new MemoryService();
    service.connectLog(log);
    return service;
  };

  it('returns a bounded tail rather than the whole log', async () => {
    for (let i = 0; i < 120; i++) {
      vi.setSystemTime(T0 + i * 1000);
      await log.append(user(`t${i}`));
    }

    // The defect this pins: `getRange('', '')` with no cap turned a long-lived
    // log into the whole episodic context, one fresh `MemoryEntry` per event.
    const episodic = await memory().queryEpisodic();
    expect(episodic).toHaveLength(50);
    expect(episodic[0]?.payload).toEqual({ text: 't70', source: 'test' });
    expect(episodic.at(-1)?.payload).toEqual({ text: 't119', source: 'test' });
  });

  it('passes the type filter and a half-given range through to the log', async () => {
    for (const [i, event] of [...Array(4).keys()]
      .flatMap((i) => [user(`u${i}`), belief(`b${i}`)])
      .entries()) {
      vi.setSystemTime(T0 + i * 1000);
      await log.append(event);
    }

    const service = memory();
    expect(await service.queryEpisodic(undefined, undefined, ['belief.added'])).toHaveLength(4);
    expect(await service.queryEpisodic(undefined, undefined, ['input.user'], 2)).toHaveLength(2);

    // A half-given range must still filter in the store, not in JavaScript: an
    // open end has to be a bound the log can push down, not a missing test. The
    // seeds interleave, so a range ending at `u1` still covers `u0, b0, u1`.
    const users = await log.query({ types: ['input.user'] });
    const bounded = await service.queryEpisodic(users[1]!.timestamp);
    expect(bounded).toHaveLength(6);
    expect(bounded.every((e) => e.timestamp >= users[1]!.timestamp)).toBe(true);
    expect(await service.queryEpisodic(undefined, users[1]!.timestamp)).toHaveLength(3);
  });

  it('reads nothing without a connected log', async () => {
    expect(await new MemoryService().queryEpisodic()).toEqual([]);
  });
});
