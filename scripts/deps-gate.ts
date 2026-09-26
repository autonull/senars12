#!/usr/bin/env tsx
/**
 * Cycle-budget gate (TODO20 D04): fails when the dependency graph gains NEW cycles.
 * Runs dpdm, counts raw circular chains from its JSON report, compares against baseline.
 *
 * Reducing cycles? Lower BASELINE in the same commit. Adding cycles? The gate fails —
 * either break the cycle or justify + raise the baseline explicitly.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Documented raw-cycle count at gate introduction (CLI prints 10 deduplicated chains). */
/** 246 = current architectural cycles (strategies → rules → nal → terms → memory → strategies)
 * not targeted by REFACTOR.todo4 Phase B scope. Baseline updated 2026-09-25. */
const BASELINE = 246;

const TARGETS = ['src/', 'core/src/', 'nar/src/', 'io/src/', 'metta/src/'];
const outPath = join(mkdtempSync(join(tmpdir(), 'deps-')), 'deps.json');

try {
  execFileSync(
    'npx',
    ['dpdm', '--circular', '--warning', 'false', '--skip-dynamic-imports', 'tree', '-o', outPath, ...TARGETS],
    { stdio: ['ignore', 'ignore', 'inherit'] }
  );
  const { circulars } = JSON.parse(readFileSync(outPath, 'utf-8')) as { circulars: string[][] };
  const count = circulars.length;
  if (count > BASELINE) {
    console.error(`deps:gate FAILED — ${count} cycles > baseline ${BASELINE} (+${count - BASELINE} new)`);
    for (const c of circulars.slice(BASELINE)) console.error(`  new: ${c.join(' -> ')}`);
    process.exit(1);
  }
  console.log(`deps:gate ok — ${count} cycles ≤ baseline ${BASELINE}`);
} finally {
  rmSync(outPath, { recursive: true, force: true });
}
