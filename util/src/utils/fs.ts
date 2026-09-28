/**
 * Filesystem primitives for append-only logs and small state files — the single
 * implementation of "ensure the directory, write/read JSON, append a JSONL
 * row" used across kernel, core, io, metta, and the bins.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface JsonlLoadResult<T> {
  rows: T[];
  invalid: number;
}

/** `mkdir -p`, returning the directory. */
export function ensureDirSync(dir: string): string {
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** `mkdir -p` for a file's parent directory. */
export function ensureParentDirSync(filePath: string): string {
  return ensureDirSync(dirname(filePath));
}

export async function ensureDir(dir: string): Promise<string> {
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function ensureParentDir(filePath: string): Promise<string> {
  return ensureDir(dirname(filePath));
}

/**
 * True when `candidate` is `root` itself or lies beneath it. Separators are
 * normalized to `/` and trailing ones dropped, so a sibling that merely shares
 * a name prefix (`/ws` vs `/ws-evil`) is rejected. The single path-containment
 * predicate behind the motor workspace, the WASI sandbox, and the fs tool scope.
 */
export const containsPath = (root: string, candidate: string): boolean => {
  const norm = (p: string): string => p.replace(/\\/g, '/').replace(/\/+$/, '') || '/';
  const r = norm(root);
  const c = norm(candidate);
  return c === r || c.startsWith(r === '/' ? '/' : `${r}/`);
};

/** Parse JSON text, yielding `fallback` on any syntax error. */
export const parseJsonOr = <T>(text: string, fallback: T): T => {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
};

/** Read and parse a JSON file. A missing or unreadable file yields `fallback`. */
export async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
  try {
    return parseJsonOr(await readFile(path, 'utf8'), fallback);
  } catch {
    return fallback;
  }
}

export function readJsonFileSync<T>(path: string, fallback: T): T {
  try {
    return parseJsonOr(readFileSync(path, 'utf8'), fallback);
  } catch {
    return fallback;
  }
}

/** Write a JSON file, creating parent directories. */
export async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await ensureParentDir(path);
  await writeFile(path, JSON.stringify(value, null, 2), 'utf8');
}

export function writeJsonFileSync(path: string, value: unknown): void {
  ensureParentDirSync(path);
  writeFileSync(path, JSON.stringify(value, null, 2), 'utf8');
}

/** Append `rows` as one JSON object per line. Returns the number appended. */
export function appendJsonl(path: string, rows: readonly unknown[]): number {
  if (rows.length === 0) return 0;
  ensureParentDirSync(path);
  appendFileSync(path, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
  return rows.length;
}

/** Rewrite a JSONL file from `rows` (compaction path). */
export async function writeJsonl(path: string, rows: readonly unknown[]): Promise<void> {
  await ensureParentDir(path);
  if (rows.length === 0) {
    await writeFile(path, '', 'utf8');
    return;
  }
  await writeFile(path, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
}

export async function appendJsonlAsync(path: string, rows: readonly unknown[]): Promise<number> {
  if (rows.length === 0) return 0;
  await ensureParentDir(path);
  await appendFile(path, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
  return rows.length;
}

/**
 * Read a JSONL file, keeping rows that `parse` accepts and counting the rest.
 * A missing file is an empty log, not an error — append-only sinks start empty.
 */
export function readJsonl<T>(path: string, parse: (value: unknown) => T | null): JsonlLoadResult<T> {
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

export async function readJsonlAsync<T>(
  path: string,
  parse: (value: unknown) => T | null
): Promise<JsonlLoadResult<T>> {
  let content: string;
  try {
    content = await readFile(path, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { rows: [], invalid: 0 };
    throw e;
  }
  const rows: T[] = [];
  let invalid = 0;
  for (const line of content.split('\n')) {
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

/** Stream a JSONL file row by row, yielding `undefined` for unreadable lines. */
export async function* iterateJsonl<T>(
  path: string,
  parse: (value: unknown) => T | null
): AsyncGenerator<T | undefined> {
  let content: string;
  try {
    content = await readFile(path, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw e;
  }
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      const row = parse(JSON.parse(line));
      yield row ?? undefined;
    } catch {
      yield undefined;
    }
  }
}
