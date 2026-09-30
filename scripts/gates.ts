#!/usr/bin/env tsx
/**
 * Run every gate in `lib/gates.ts` — the fix for the reason the docs-drift gate
 * sat red for a whole pass of TODO28 without being noticed.
 *
 * Gates are run in order and the run stops at the first failure, so the first
 * thing on screen is the thing that broke. `--tier slow` adds the two tiers CI
 * already runs in their own jobs.
 *
 * The second thing this does is check that every gate it knows about is also
 * run by `ci.yml`. A list that only exists here would fix the "nobody runs the
 * gates" failure mode and leave the "the gate lives only in CI" one — which is
 * how a gate gets skipped by a workflow that is edited without reading the list.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GATES, missingGateScripts } from './lib/gates.js';
import { ROOT } from './lib/root.js';

const includeSlow = process.argv.includes('--tier') && process.argv[process.argv.indexOf('--tier') + 1] === 'slow';
const gates = GATES.filter((gate) => includeSlow || gate.tier === 'gate');

const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  scripts?: Record<string, string>;
};
const missing = missingGateScripts(manifest.scripts ?? {});
if (missing.length > 0) {
  console.error(`gates: no pnpm script for ${missing.join(', ')}`);
  process.exit(1);
}

const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
const absent = gates.map((gate) => gate.name).filter((name) => !ci.includes(name));
if (absent.length > 0) {
  console.error(`gates: not run by ci.yml — ${absent.join(', ')}`);
  process.exit(1);
}

for (const [index, gate] of gates.entries()) {
  console.log(`\n─── [${index + 1}/${gates.length}] ${gate.name}`);
  const { status, error } = spawnSync(gate.command[0]!, gate.command.slice(1), {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (error) {
    console.error(`gates: ${gate.name} could not start — ${error.message}`);
    process.exit(1);
  }
  if (status !== 0) {
    console.error(`\ngates: FAILED at ${gate.name} (${gates.length - index - 1} not run)`);
    process.exit(status ?? 1);
  }
}

console.log('\ngates: all green');
