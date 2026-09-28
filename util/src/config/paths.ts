import { join } from 'node:path';

/** Root of the runtime cache/checkpoint tree (state snapshots, ledgers, datasets). */
export const CACHE_DIR = '.cache';

/** Absolute path to a file or directory inside the cache tree. */
export const cachePath = (...segments: string[]): string => join(CACHE_DIR, ...segments);
