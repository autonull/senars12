import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './root.js';

/** Source roots analysed for circular imports by every dpdm-based gate. */
export const DPDM_TARGETS = ['src/', 'core/src/', 'nar/src/', 'io/src/', 'metta/src/'];

/**
 * Raw circular dependency chains from dpdm. `--transform` resolves types through
 * the TS transform, so type-only edges no longer count as cycles.
 */
export const circularChains = ({ transform = true }: { transform?: boolean } = {}): string[][] => {
  const workDir = mkdtempSync(join(tmpdir(), 'dpdm-'));
  const outPath = join(workDir, 'deps.json');
  try {
    execFileSync(
      'pnpm',
      [
        'dlx',
        'dpdm',
        '--circular',
        '--warning',
        'false',
        '--skip-dynamic-imports',
        'circular',
        ...(transform ? ['--transform'] : ['tree']),
        '-o',
        outPath,
        ...DPDM_TARGETS,
      ],
      { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] }
    );
    return JSON.parse(readFileSync(outPath, 'utf-8')).circulars as string[][];
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
};

/** Number of raw circular chains — the metric the gates budget against. */
export const countCircularChains = (options: { transform?: boolean } = {}): number =>
  circularChains(options).length;
