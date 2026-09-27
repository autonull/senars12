/**
 * Append-only JSONL persistence helpers — the single read/append implementation
 * for the kernel's event and derivation logs.
 */

import { appendFileSync, existsSync, readFileSync } from 'node:fs';

export interface JsonlLoadResult<T> {
  rows: T[];
  invalid: number;
}

/** Append `rows` as one JSON object per line. Returns the number appended. */
export function appendJsonl(path: string, rows: readonly unknown[]): number {
  if (rows.length === 0) return 0;
  appendFileSync(path, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
  return rows.length;
}

/**
 * Read a JSONL file, keeping rows that `parse` accepts and counting the rest.
 * A missing file is an empty log, not an error — append-only sinks start empty.
 */
export function readJsonl<T>(
  path: string,
  parse: (value: unknown) => T | null
): JsonlLoadResult<T> {
  if (!existsSync(path)) return { rows: [], invalid: 0 };
  const rows: T[] = [];
  let invalid = 0;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = parse(JSON.parse(trimmed));
      if (row === null) invalid++;
      else rows.push(row);
    } catch {
      invalid++;
    }
  }
  return { rows, invalid };
}
