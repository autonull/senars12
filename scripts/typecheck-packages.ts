#!/usr/bin/env tsx
/**
 * Workspace typecheck gate — consolidated into root typecheck.
 *
 * The root `tsc --noEmit -p tsconfig.root.json` now covers all consolidated sources
 * in `src/`. The former `util`, `core`, `io`, `metta`, `nar` packages have been
 * merged into the root. This gate is kept for compatibility but delegates to the
 * root typecheck.
 */
import { spawnSync } from 'node:child_process';

const result = spawnSync('pnpm', ['exec', 'tsc', '--noEmit', '-p', 'tsconfig.root.json'], {
  cwd: process.cwd(),
  encoding: 'utf-8',
});

if (result.status !== 0) {
  console.error(`typecheck:packages FAILED — root typecheck failed:\n${result.stdout ?? ''}${result.stderr ?? ''}`);
  process.exit(1);
}

console.log('typecheck:packages — root typecheck clean (consolidated packages)');
