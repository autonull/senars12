/**
 * Import Boundary Gate — the fold has no ambient I/O or entropy.
 *
 * Every effect in the fold goes through the `Env` seam: clock, RNG and IDs are
 * injected, so a seeded run replays byte-identically. This gate scans the pure
 * fold modules for the forbidden ambient sources — filesystem/network imports,
 * `Math.random()` and `Date.now()` — and fails on any *new* occurrence.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

function dirname(path: string): string {
  return path.substring(0, path.lastIndexOf('/'));
}

describe('Import Boundary Gate', () => {
  let importBoundaryResult: ReturnType<typeof spawnSync>;

  beforeAll(() => {
    importBoundaryResult = spawnSync('pnpm', ['run', 'import:boundary'], {
      cwd: ROOT,
      stdio: 'pipe',
    });
  });

  it('should pass import-boundary check', () => {
    // The script exits with 0 on success, non-zero on violations
    if (importBoundaryResult.status !== 0) {
      const stderr = importBoundaryResult.stderr?.toString() ?? '';
      const stdout = importBoundaryResult.stdout?.toString() ?? '';
      console.error('import:boundary FAILED:');
      console.error(stdout);
      console.error(stderr);
    }

    expect(importBoundaryResult.status).toBe(0);
  });

  it('should have a baseline file', () => {
    const baselinePath = join(ROOT, 'scripts', 'import-boundary-baseline.json');
    expect(existsSync(baselinePath)).toBe(true);

    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
    expect(typeof baseline).toBe('object');
  });

  it('should not have new violations since baseline', () => {
    // This is implicitly tested by the import:boundary script
    // which compares current violations against the baseline
    expect(importBoundaryResult.status).toBe(0);
  });
});