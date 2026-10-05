import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  appendJsonl,
  appendJsonlAsync,
  appendJsonlRow,
  appendJsonlRowAsync,
  containsPath,
  parseJsonOr,
  readJsonFile,
  readJsonFileSync,
  readJsonl,
  readJsonlAsync,
  writeJsonFile,
  writeJsonFileSync,
  writeJsonl,
} from '@senars/util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('fs primitives', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'senars-fs-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const number = (value: unknown): number | null =>
    typeof value === 'object' && value !== null && 'n' in value
      ? Number((value as { n: unknown }).n)
      : null;

  describe('JSON documents', () => {
    it('round-trips through the sync and async writers with the same bytes', async () => {
      const value = { b: 2, a: [1, 2] };

      writeJsonFileSync(join(dir, 'sync.json'), value);
      await writeJsonFile(join(dir, 'async.json'), value);

      expect(readFileSync(join(dir, 'sync.json'), 'utf8')).toBe(
        readFileSync(join(dir, 'async.json'), 'utf8')
      );
      expect(readJsonFileSync(join(dir, 'sync.json'), null)).toEqual(value);
      await expect(readJsonFile(join(dir, 'async.json'), null)).resolves.toEqual(value);
    });

    it('creates the parent directory chain', () => {
      const nested = join(dir, 'a', 'b', 'c.json');

      writeJsonFileSync(nested, { ok: true });

      expect(readJsonFileSync(nested, null)).toEqual({ ok: true });
    });

    it('yields the fallback for missing and malformed files', () => {
      expect(readJsonFileSync(join(dir, 'absent.json'), 'fallback')).toBe('fallback');

      const broken = join(dir, 'broken.json');
      writeJsonFileSync(broken, { ok: true });
      writeFileSync(broken, '{ not json');

      expect(readJsonFileSync(broken, 'fallback')).toBe('fallback');
      expect(parseJsonOr('{ not json', 'fallback')).toBe('fallback');
    });
  });

  describe('JSONL appends', () => {
    it('frames rows identically from the sync and async appenders', async () => {
      const rows = [{ n: 0 }, { n: 1 }];

      appendJsonl(join(dir, 'sync.jsonl'), rows);
      await appendJsonlAsync(join(dir, 'async.jsonl'), rows);

      expect(readFileSync(join(dir, 'sync.jsonl'), 'utf8')).toBe(
        readFileSync(join(dir, 'async.jsonl'), 'utf8')
      );
      expect(readFileSync(join(dir, 'sync.jsonl'), 'utf8')).toBe('{"n":0}\n{"n":1}\n');
    });

    it('appends without disturbing earlier rows and reports the count', () => {
      const path = join(dir, 'events.jsonl');

      expect(appendJsonl(path, [{ n: 0 }])).toBe(1);
      expect(appendJsonl(path, [{ n: 1 }, { n: 2 }])).toBe(2);
      expect(appendJsonl(path, [])).toBe(0);

      expect(readJsonl(path, number).rows).toEqual([0, 1, 2]);
    });

    it('frames a single row identically from the row and batch appenders', async () => {
      const row = { n: 0 };

      appendJsonlRow(join(dir, 'row.jsonl'), row);
      await appendJsonlRowAsync(join(dir, 'row-async.jsonl'), row);
      appendJsonl(join(dir, 'batch.jsonl'), [row]);

      expect(readFileSync(join(dir, 'row.jsonl'), 'utf8')).toBe(
        readFileSync(join(dir, 'row-async.jsonl'), 'utf8')
      );
      expect(readFileSync(join(dir, 'row.jsonl'), 'utf8')).toBe(
        readFileSync(join(dir, 'batch.jsonl'), 'utf8')
      );
      expect(appendJsonlRow(join(dir, 'row.jsonl'), row)).toBe(1);
    });

    it('rewrites a compacted file and empties an empty one', async () => {
      const path = join(dir, 'compact.jsonl');
      appendJsonl(path, [{ n: 0 }, { n: 1 }]);

      await writeJsonl(path, [{ n: 9 }]);
      expect(readJsonl(path, number).rows).toEqual([9]);

      await writeJsonl(path, []);
      expect(readFileSync(path, 'utf8')).toBe('');
      expect(readJsonl(path, number).rows).toEqual([]);
    });
  });

  describe('JSONL reads', () => {
    it('treats an absent file as an empty log, not an error', async () => {
      const path = join(dir, 'never-written.jsonl');

      expect(readJsonl(path, number)).toEqual({ rows: [], invalid: 0 });
      await expect(readJsonlAsync(path, number)).resolves.toEqual({ rows: [], invalid: 0 });
    });

    it('counts rejected rows and malformed lines while keeping accepted ones', async () => {
      const path = join(dir, 'mixed.jsonl');
      writeFileSync(path, '{"n":1}\n\nnot json\n{"n":2}\n"rejected"\n');

      expect(readJsonl(path, number)).toEqual({ rows: [1, 2], invalid: 2 });
      await expect(readJsonlAsync(path, number)).resolves.toEqual({ rows: [1, 2], invalid: 2 });
    });
  });

  describe('containsPath', () => {
    it('accepts the root and its descendants but not a name-prefixed sibling', () => {
      expect(containsPath('/ws', '/ws')).toBe(true);
      expect(containsPath('/ws', '/ws/src/a.ts')).toBe(true);
      expect(containsPath('/ws/', '/ws/src')).toBe(true);
      expect(containsPath('/ws', '/ws-evil')).toBe(false);
      expect(containsPath('/ws', '/etc/passwd')).toBe(false);
    });
  });
});
