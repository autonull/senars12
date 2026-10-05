/**
 * The ledger's synchronous mirror, and `append`'s return of the validated row.
 *
 * Falsifies that the mirror is a bounded append-ordered window of what was
 * *validated* — not a copy of the caller's draft — that it defaults off, and that
 * a reload continues the window rather than restarting it.
 */

import { createLedger, DEFAULT_MIRROR_SIZE } from '@senars/util/ledger';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

const RowSchema = z.object({ at: z.number(), label: z.string(), count: z.number().default(1) });

const dirs: string[] = [];
const tmpBase = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'ledger-mirror-'));
  dirs.push(dir);
  return dir;
};

afterEach(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
  dirs.length = 0;
});

describe('Ledger mirror', () => {
  it('reports nothing when no mirror was requested', async () => {
    const ledger = createLedger(await tmpBase(), RowSchema);

    ledger.append({ label: 'a' });

    expect(ledger.records()).toEqual([]);
  });

  it('reports the validated row in append order', async () => {
    const ledger = createLedger(await tmpBase(), RowSchema, { mirror: { maxSize: 10 } });

    ledger.append({ label: 'a' });
    ledger.append({ label: 'b' });

    expect(ledger.records().map((r) => r.label)).toEqual(['a', 'b']);
  });

  it("holds the schema-applied row rather than the caller's draft", async () => {
    const ledger = createLedger(await tmpBase(), RowSchema, { mirror: { maxSize: 10 } });

    ledger.append({ label: 'a' });

    // `count` came from the schema default; a draft copy would have no such field.
    expect(ledger.records()[0]).toHaveProperty('count', 1);
  });

  it('returns the validated row from append', async () => {
    const ledger = createLedger(await tmpBase(), RowSchema, { mirror: { maxSize: 10 } });

    const written = ledger.append({ label: 'a' });

    expect(written.label).toBe('a');
    expect(written.count).toBe(1);
    expect(written.at).toBeTypeOf('number');
  });

  it('accepts a caller timestamp and stamps one otherwise', async () => {
    const ledger = createLedger(await tmpBase(), RowSchema, { mirror: { maxSize: 10 } });

    const stamped = ledger.append({ label: 'a' });
    const explicit = ledger.append({ at: 42, label: 'b' });

    expect(stamped.at).toBeGreaterThan(0);
    expect(explicit.at).toBe(42);
  });

  it('drops the oldest rows past the bound', async () => {
    const ledger = createLedger(await tmpBase(), RowSchema, { mirror: { maxSize: 3 } });

    for (const label of ['a', 'b', 'c', 'd', 'e']) ledger.append({ label });

    expect(ledger.records().map((r) => r.label)).toEqual(['c', 'd', 'e']);
  });

  it('continues the window from a reload', async () => {
    const dir = await tmpBase();
    const writer = createLedger(dir, RowSchema, { mirror: { maxSize: 10 } });
    writer.append({ at: 1, label: 'a' });
    writer.append({ at: 2, label: 'b' });

    const reader = createLedger(dir, RowSchema, { mirror: { maxSize: 10 } });
    expect(reader.records()).toEqual([]);
    reader.loadMirror(await writer.query({}));
    reader.append({ label: 'c' });

    expect(reader.records().map((r) => r.label)).toEqual(['a', 'b', 'c']);
  });

  it('replaces the window on reload rather than appending to it', async () => {
    const dir = await tmpBase();
    const writer = createLedger(dir, RowSchema, { mirror: { maxSize: 10 } });
    writer.append({ at: 1, label: 'a' });

    const reader = createLedger(dir, RowSchema, { mirror: { maxSize: 10 } });
    reader.loadMirror(await writer.query({}));
    reader.loadMirror(await writer.query({}));

    expect(reader.records().map((r) => r.label)).toEqual(['a']);
  });

  it('leaves the mirror empty for a reload into a ledger that asked for none', async () => {
    const dir = await tmpBase();
    const writer = createLedger(dir, RowSchema, { mirror: { maxSize: 10 } });
    writer.append({ label: 'a' });

    const reader = createLedger(dir, RowSchema);
    reader.loadMirror(await writer.query({}));

    expect(reader.records()).toEqual([]);
  });

  it('agrees with the disk after a compaction', async () => {
    const dir = await tmpBase();
    const ledger = createLedger(dir, RowSchema, { mirror: { maxSize: 10 } });
    ledger.append({ at: 1, label: 'a', count: 1 });
    ledger.append({ at: 2, label: 'b', count: 2 });

    const { kept, dropped } = await ledger.compact((row) => row.label);
    expect(dropped).toBe(0);
    expect(kept).toBe(2);
    expect(ledger.records().map((r) => r.label)).toEqual(['a', 'b']);
  });

  it('defaults the bound to a bounded window', () => {
    expect(DEFAULT_MIRROR_SIZE).toBe(10_000);
  });
});
