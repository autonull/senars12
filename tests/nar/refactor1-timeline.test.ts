import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InMemoryEventLog, SqliteEventLog } from '@senars/core/eventlog';
import { EpisodicMemory } from '@senars/nar/memory/EpisodicMemory.js';
import { ProofStreamRing } from '@senars/nar/rules/recorder.js';
import { afterAll, describe, expect, it } from 'vitest';

const dirs: string[] = [];
const tmpBase = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'refactor1-timeline-'));
  dirs.push(dir);
  return dir;
};
afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true });
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Bench 84 — indexed episode timeline', () => {
  it('indexed sessionId/correlationId queries match brute-force and exclude foreign', async () => {
    const base = await tmpBase();
    const mem = new EpisodicMemory({ basePath: base });
    for (const [cid, sid] of [
      ['c1', 's1'],
      ['c1', 's1'],
      ['c2', 's2'],
    ] as const) {
      await mem.log('dialogue', `turn-${cid}`, {
        correlationId: cid,
        sessionId: sid,
        turnId: `${cid}:1`,
      });
      await sleep(2);
    }

    const indexed = await mem.getEpisodes({ sessionId: 's1' });
    expect(indexed.map((e) => e.metadata.correlationId)).toEqual(['c1', 'c1']);
    const byCid = await mem.getEpisodes({ correlationId: 'c2' });
    expect(byCid).toHaveLength(1);
    expect(byCid[0]!.metadata.sessionId).toBe('s2');

    // Parity with brute force (scan path, index bypassed via fresh instance).
    const scan = await mem.getEpisodes();
    const brute = scan
      .filter((e) => (e.metadata as { sessionId?: string }).sessionId === 's1')
      .sort((a, b) => a.timestamp - b.timestamp);
    expect([...indexed].sort((a, b) => a.timestamp - b.timestamp)).toEqual(brute);

    // type + indexed conjunction
    const reactions = await mem.getEpisodes({ sessionId: 's1', type: 'reaction' });
    expect(reactions).toEqual([]);
  });

  it('indexed path picks up episodes logged after the index build', async () => {
    const base = await tmpBase();
    const mem = new EpisodicMemory({ basePath: base });
    await mem.log('dialogue', 'first', { correlationId: 'c9', sessionId: 's9' });
    expect(await mem.getEpisodes({ correlationId: 'c9' })).toHaveLength(1); // builds index
    await mem.log('dialogue', 'second', { correlationId: 'c9', sessionId: 's9' });
    expect(await mem.getEpisodes({ correlationId: 'c9' })).toHaveLength(2);
  });
});

describe('Bench 84 — Episode causal infra', () => {
  it('assigns unique ULID ids at write and round-trips causal fields through JSONL', async () => {
    const base = await tmpBase();
    const mem = new EpisodicMemory({ basePath: base });
    await mem.log('dialogue', 'turn', { correlationId: 'cA', sessionId: 'sA', turnId: 'cA:1' });
    await sleep(2);
    await mem.log('reaction', 'react', {
      correlationId: 'cA',
      sessionId: 'sA',
      turnId: 'cA:1',
      kind: 'correct',
      causes: ['cA:1'],
    });
    const episodes = await mem.getEpisodes({ sessionId: 'sA' });
    expect(episodes).toHaveLength(2);
    const [turn, reaction] = episodes.sort((a, b) => a.timestamp - b.timestamp);
    expect(turn!.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(reaction!.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(reaction!.id).not.toBe(turn!.id);
    expect(reaction!.causes).toEqual(['cA:1']);
  });
});

describe('Bench 84 — EventLog.query', () => {
  const base = Date.now();
  const makeEvents = () => [
    {
      id: 'a1',
      type: 'input.user',
      timestamp: base + 100,
      correlationId: 'q1',
      payload: { text: 'hi', source: 'cycle' },
    },
    {
      id: 'a2',
      type: 'tool.request',
      timestamp: base + 200,
      correlationId: 'q1',
      payload: { toolName: 't', args: {}, timeoutMs: 1 },
    },
    {
      id: 'a3',
      type: 'input.user',
      timestamp: base + 300,
      correlationId: 'q2',
      payload: { text: 'yo', source: 'cycle' },
    },
  ];

  it('InMemoryEventLog filters by correlationId, types, timeRange, limit', async () => {
    const log = new InMemoryEventLog();
    for (const e of makeEvents()) await log.append(e as never);
    expect(
      (await log.query({ correlationId: 'q1' })).map(
        (e) =>
          (e.payload as { text?: string; toolName?: string }).text ??
          (e.payload as { toolName?: string }).toolName
      )
    ).toEqual(['hi', 't']);
    expect(
      (await log.query({ types: ['input.user'] })).map((e) => (e.payload as { text?: string }).text)
    ).toEqual(['hi', 'yo']);
    expect(
      (await log.query({ timeRange: [base, base + 60_000] })).map(
        (e) =>
          (e.payload as { text?: string; toolName?: string }).text ??
          (e.payload as { toolName?: string }).toolName
      )
    ).toEqual(['hi', 't', 'yo']);
    expect(
      (await log.query({ correlationId: 'q1', limit: 1 })).map(
        (e) => (e.payload as { toolName?: string }).toolName
      )
    ).toEqual(['t']);
  });

  it('SqliteEventLog indexed query parity with InMemoryEventLog', async () => {
    const dir = await tmpBase();
    const log = new SqliteEventLog({ path: join(dir, 'events.sqlite') });
    for (const e of makeEvents()) await log.append(e as never);
    expect(
      (await log.query({ correlationId: 'q1' })).map(
        (e) =>
          (e.payload as { text?: string; toolName?: string }).text ??
          (e.payload as { toolName?: string }).toolName
      )
    ).toEqual(['hi', 't']);
    expect(
      (await log.query({ types: ['input.user'] })).map((e) => (e.payload as { text?: string }).text)
    ).toEqual(['hi', 'yo']);
    expect(
      (await log.query({ timeRange: [base, base + 60_000] })).map(
        (e) =>
          (e.payload as { text?: string; toolName?: string }).text ??
          (e.payload as { toolName?: string }).toolName
      )
    ).toEqual(['hi', 't', 'yo']);
    expect(
      (await log.query({ correlationId: 'q1', limit: 1 })).map(
        (e) => (e.payload as { toolName?: string }).toolName
      )
    ).toEqual(['t']);
    await log.close();
  });
});

describe('Bench 84 — ProofStream', () => {
  it('replays ring snapshot in order, goes live, and respects unsubscribe/abort', async () => {
    const ring = new ProofStreamRing<string>(4);
    ring.push('x1');
    ring.push('x2');
    const collected: string[] = [];
    const stream = ring.stream()[Symbol.asyncIterator]();
    const drain = (async () => {
      for (;;) {
        const next = await stream.next();
        if (next.done) return;
        collected.push(next.value);
        if (collected.length === 4) await stream.return?.(undefined);
      }
    })();
    await Promise.resolve();
    ring.push('x3');
    await Promise.resolve();
    ring.push('x4');
    await drain;
    expect(collected).toEqual(['x1', 'x2', 'x3', 'x4']);
    // ring stays bounded
    ring.push('x5');
    ring.push('x6');
    expect(ring.snapshot()).toEqual(['x3', 'x4', 'x5', 'x6']);
  });

  it('abort terminates the stream; zero-cost when nobody subscribes', async () => {
    const ring = new ProofStreamRing<string>(8);
    const ctl = new AbortController();
    const iter = ring.stream(ctl.signal)[Symbol.asyncIterator]();
    const next = iter.next();
    await Promise.resolve();
    ctl.abort();
    const result = await next;
    expect(result.done).toBe(true);
    ring.push('b'); // no listeners — must not throw
    expect(ring.snapshot()).toEqual(['b']);
  });
});
