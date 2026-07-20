import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteEventLog } from '@senars/core/eventlog';
import type { CognitiveEvent } from '@senars/core/eventlog';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

function tmpDb(): string {
  return join(mkdtempSync(join(tmpdir(), 'sqlite-eventlog-test-')), 'events.db');
}

describe('SqliteEventLog', () => {
  let dbPath: string;
  let log: SqliteEventLog;

  beforeEach(() => {
    dbPath = tmpDb();
    log = new SqliteEventLog({ path: dbPath });
  });

  afterEach(async () => {
    await log.close();
    rmSync(dbPath, { force: true });
  });

  it('appends and returns an event with id and timestamp', async () => {
    const event = await log.append({
      type: 'input.user',
      payload: { text: 'hello', source: 'test' },
      correlationId: '00000000-0000-0000-0000-000000000001',
    });
    expect(event.id).toBeTruthy();
    expect(event.timestamp).toBeGreaterThan(0);
    expect(event.type).toBe('input.user');
    expect(event.payload).toEqual({ text: 'hello', source: 'test' });
  });

  it('rejects events with invalid payload', async () => {
    await expect(
      log.append({
        type: 'input.user',
        payload: { wrong: 'data' },
        correlationId: '00000000-0000-0000-0000-000000000002',
      })
    ).rejects.toThrow();
  });

  it('rejects oversized events', async () => {
    const small = new SqliteEventLog({ path: tmpDb(), maxEventSize: 10 });
    await expect(
      small.append({
        type: 'input.user',
        payload: { text: 'too long', source: 'test' },
        correlationId: '00000000-0000-0000-0000-000000000003',
      })
    ).rejects.toThrow('exceeds max');
    await small.close();
  });

  it('throws on append when closed', async () => {
    await log.close();
    await expect(
      log.append({
        type: 'input.user',
        payload: { text: 'x', source: 'test' },
        correlationId: '00000000-0000-0000-0000-000000000004',
      })
    ).rejects.toThrow('Event log is closed');
  });

  it('reports size', async () => {
    expect(log.size).toBe(0);
    await log.append({
      type: 'input.user',
      payload: { text: 'a', source: 'test' },
      correlationId: '00000000-0000-0000-0000-000000000005',
    });
    expect(log.size).toBe(1);
    await log.append({
      type: 'belief.added',
      payload: { term: 'bird', truth: { frequency: 1, confidence: 0.9 } },
      correlationId: '00000000-0000-0000-0000-000000000006',
    });
    expect(log.size).toBe(2);
  });

  it('getRange returns events by id range', async () => {
    const e1 = await log.append({
      type: 'input.user',
      payload: { text: 'first', source: 'test' },
      correlationId: 'a0000000-0000-0000-0000-000000000001',
    });
    const e2 = await log.append({
      type: 'input.user',
      payload: { text: 'second', source: 'test' },
      correlationId: 'a0000000-0000-0000-0000-000000000002',
    });
    const e3 = await log.append({
      type: 'input.user',
      payload: { text: 'third', source: 'test' },
      correlationId: 'a0000000-0000-0000-0000-000000000003',
    });

    const all = await log.getRange('');
    expect(all).toHaveLength(3);

    // ids increase lexicographically for same-millisecond ULIDs
    expect(e1.id < e2.id).toBe(true);
    expect(e2.id < e3.id).toBe(true);

    const range = await log.getRange(e1.id, e3.id);
    expect(range).toHaveLength(2);
    expect(range[0]!.id).toBe(e2.id);
    expect(range[1]!.id).toBe(e3.id);

    const fromE2 = await log.getRange(e1.id);
    expect(fromE2).toHaveLength(2);
    expect(fromE2[0]!.id).toBe(e2.id);
  });

  it('getRange without toId returns all events after fromId', async () => {
    const e1 = await log.append({
      type: 'input.user',
      payload: { text: 'a', source: 'test' },
      correlationId: 'b0000000-0000-0000-0000-000000000001',
    });
    await log.append({
      type: 'input.user',
      payload: { text: 'b', source: 'test' },
      correlationId: 'b0000000-0000-0000-0000-000000000002',
    });

    const range = await log.getRange(e1.id);
    expect(range).toHaveLength(1);
  });

  it('subscribe delivers new events to async iterator', async () => {
    const collected: CognitiveEvent[] = [];
    const sub = log.subscribe({ types: ['input.user'] });
    const iter = sub[Symbol.asyncIterator]();

    const event = await log.append({
      type: 'input.user',
      payload: { text: 'hello', source: 'test' },
      correlationId: 'c0000000-0000-0000-0000-000000000001',
    });

    const result = await iter.next();
    expect(result.value).toBeDefined();
    expect((result.value as CognitiveEvent).id).toBe(event.id);

    await iter.return?.();
  });

  it('subscribe with fromId replays past events', async () => {
    const e1 = await log.append({
      type: 'input.user',
      payload: { text: 'past', source: 'test' },
      correlationId: 'd0000000-0000-0000-0000-000000000001',
    });

    const sub = log.subscribe({ fromId: e1.id });
    const iter = sub[Symbol.asyncIterator]();

    const e2 = await log.append({
      type: 'input.user',
      payload: { text: 'future', source: 'test' },
      correlationId: 'd0000000-0000-0000-0000-000000000002',
    });

    const next1 = await iter.next();
    expect((next1.value as CognitiveEvent).id).toBe(e2.id);

    await iter.return?.();
  });

  it('subscribe with fromId before any event', async () => {
    const sub = log.subscribe({ fromId: '' });
    const iter = sub[Symbol.asyncIterator]();

    const e1 = await log.append({
      type: 'input.user',
      payload: { text: 'replayed', source: 'test' },
      correlationId: 'd0000000-0000-0000-0000-000000000003',
    });

    const next1 = await iter.next();
    expect((next1.value as CognitiveEvent).id).toBe(e1.id);

    await iter.return?.();
  });

  it('subscribe with type filter', async () => {
    await log.append({
      type: 'config.set',
      payload: { path: 'key', value: 'val' },
      correlationId: 'e0000000-0000-0000-0000-000000000001',
    });

    const sub = log.subscribe({ types: ['input.user'] });
    const iter = sub[Symbol.asyncIterator]();

    await log.append({
      type: 'input.user',
      payload: { text: 'match', source: 'test' },
      correlationId: 'e0000000-0000-0000-0000-000000000002',
    });

    const result = await iter.next();
    expect((result.value as CognitiveEvent).type).toBe('input.user');

    await iter.return?.();
  });

  it('persists events across instances', async () => {
    const e1 = await log.append({
      type: 'input.user',
      payload: { text: 'persist', source: 'test' },
      correlationId: 'f0000000-0000-0000-0000-000000000001',
    });
    await log.close();

    const log2 = new SqliteEventLog({ path: dbPath });
    expect(log2.size).toBe(1);

    const range = await log2.getRange(e1.id);
    expect(range).toHaveLength(0);

    const allRange = await log2.getRange('');
    expect(allRange).toHaveLength(1);
    expect(allRange[0]!.payload).toEqual({ text: 'persist', source: 'test' });

    await log2.close();
  });

  it('getSnapshot and saveSnapshot', async () => {
    const data = { count: 42, lastEvent: 'abc' };
    await log.saveSnapshot('test-projection', 1, data);

    const loaded = await log.getSnapshot<typeof data>('test-projection', 1);
    expect(loaded).toEqual(data);

    const missing = await log.getSnapshot('test-projection', 2);
    expect(missing).toBeNull();
  });

  it('subscribe handles early return', async () => {
    const sub = log.subscribe();
    const iter = sub[Symbol.asyncIterator]();
    await iter.return?.();
  });
});
