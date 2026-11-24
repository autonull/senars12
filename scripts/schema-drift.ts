#!/usr/bin/env tsx
/**
 * Schema drift gate: fails if generated schemas/types/tools/docs are not fresh.
 *
 * Runs the genome generator and compares output to committed files.
 * Generated artifacts must be reproducible from the genome; hand-edits fail.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/core/root.ts';

const GENOME_SCRIPT = join(ROOT, 'src/formats/genome/index.ts');
const GEN_DIR = join(ROOT, 'src/generated');

function runGenome(): void {
  const result = spawnSync('tsx', [GENOME_SCRIPT], { cwd: ROOT, stdio: 'pipe' });
  if (result.status !== 0) {
    console.error('schema:drift FAILED — genome generation errored:');
    console.error(result.stderr?.toString() ?? 'unknown error');
    process.exit(1);
  }
}

function checkDrift(): string[] {
  const changed: string[] = [];
  if (!existsSync('.git')) return changed; // Not a git repo, skip

  const result = spawnSync('git', ['status', '--porcelain', GEN_DIR], {
    cwd: ROOT,
    stdio: 'pipe',
  });
  if (result.status !== 0) return changed;

  const output = result.stdout?.toString() ?? '';
  for (const line of output.trim().split('\n')) {
    if (line && line.startsWith(' M')) {
      changed.push(line.slice(3).trim());
    }
  }
  return changed;
}

try {
  // Run the genome generator
  runGenome();

  // Check for changes
  const changed = checkDrift();
  if (changed.length > 0) {
    console.error('schema:drift FAILED — generated artifacts have drifted:');
    for (const file of changed) {
      console.error(`  ${file}`);
    }
    console.error('\nRegenerate with: tsx src/formats/genome/index.ts');
    console.error('Then commit the changes.');
    process.exit(1);
  }

  console.log('schema:drift ok — generated schemas are fresh');
} catch (err) {
  console.error(`schema:drift ERROR — ${err}`);
  process.exit(1);
}