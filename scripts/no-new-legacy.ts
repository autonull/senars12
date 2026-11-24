#!/usr/bin/env tsx
/**
 * Legacy package file-growth gate: fails when a new file appears under a legacy package.
 *
 * Legacy packages: core, nar, io, metta, util.
 * The one-fold migration deletes these packages; no new code should be added to them.
 * This gate maintains a baseline of tracked files and fails on additions.
 *
 * Baseline is stored in .github/legacy-file-baseline.json and must be updated
 * in the same commit that intentionally adds a file (e.g. a shim that will be
 * deleted in the same milestone).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import glob from 'glob';
import { ROOT } from './lib/core/root.ts';

const LEGACY_PKGS = ['core', 'nar', 'io', 'metta', 'util'] as const;
const BASELINE_PATH = join(ROOT, '.github', 'legacy-file-baseline.json');

function collectFiles(pkg: string): string[] {
  const srcDir = join(ROOT, pkg, 'src');
  if (!existsSync(srcDir)) return [];
  return glob.sync('**/*.ts', { cwd: srcDir, absolute: false }).map((f: string) => `${pkg}/src/${f}`);
}

function loadBaseline(): Record<string, string[]> {
  if (!existsSync(BASELINE_PATH)) return {};
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'));
}

function saveBaseline(baseline: Record<string, string[]>): void {
  mkdirSync(join(ROOT, '.github'), { recursive: true });
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
}

const updateBaseline = process.argv.includes('--update-baseline');
const baseline = loadBaseline();
const violations: string[] = [];

for (const pkg of LEGACY_PKGS) {
  const currentFiles = collectFiles(pkg).sort();
  const knownFiles = (baseline[pkg] ?? []).sort();

  const newFiles = currentFiles.filter((f) => !knownFiles.includes(f));
  if (newFiles.length > 0) {
    violations.push(`${pkg}: ${newFiles.length} new file(s)`);
    for (const f of newFiles) {
      violations.push(`  + ${f}`);
    }
  }

  // Update baseline to current (so the gate only catches *new* additions from now on)
  baseline[pkg] = currentFiles;
}

if (updateBaseline) {
  saveBaseline(baseline);
  console.log('no-new-legacy — baseline updated');
  process.exit(0);
}

if (violations.length > 0) {
  console.error('no-new-legacy FAILED — new files in legacy packages:\n' + violations.join('\n'));
  console.error('\nIf this is intentional (a shim to be deleted in the same milestone),');
  console.error('update the baseline in the same commit:');
  console.error(`  pnpm tsx scripts/no-new-legacy.ts --update-baseline`);
  process.exit(1);
}

console.log('no-new-legacy ok — no new files in legacy packages');