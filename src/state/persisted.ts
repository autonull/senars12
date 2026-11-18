/**
 * The persisted-boundary read surface (CORE.19 C7.6): read what a restart would
 * resume without starting a NAR, so `--status`/`--doctor` report durable state
 * honestly (D15) instead of only what happens to be in memory.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cachePath } from '@senars/util';
import { BOUNDARY_FILENAME, type ConsistencyBoundary, decodeBoundary } from './boundary.js';

/** Where the state files live when a NAR is not configured with a `statePath`. */
export const DEFAULT_NAR_STATE_PATH = (): string => cachePath('nar-state');

/** Read the persisted boundary, or `null` when nothing is saved (or it is unreadable). */
export const readPersistedBoundary = (statePath?: string): ConsistencyBoundary | null => {
  const target = path.resolve(statePath ?? DEFAULT_NAR_STATE_PATH(), BOUNDARY_FILENAME);
  try {
    return decodeBoundary(readFileSync(target, 'utf-8'));
  } catch {
    return null;
  }
};
