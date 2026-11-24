#!/usr/bin/env tsx
/**
 * Migrate test file relative imports to path aliases.
 *
 * Replaces patterns like:
 *   ../../../nar/src/xyz -> @senars/nar/xyz
 *   ../../../core/src/xyz -> @senars/core/xyz
 *   ../../../io/src/xyz -> @senars/io/xyz
 *   ../../../metta/src/xyz -> @senars/metta/xyz
 *   ../../../util/src/xyz -> @senars/util/xyz
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { glob, globSync } from 'glob';

const ROOT = resolve(import.meta.dirname, '..');
const TEST_DIR = join(ROOT, 'tests');

const PACKAGE_MAPPINGS: Record<string, string> = {
  'nar': '@senars/nar',
  'core': '@senars/core',
  'io': '@senars/io',
  'metta': '@senars/metta',
  'util': '@senars/util',
};

function migrateFile(filePath: string): boolean {
  const content = readFileSync(filePath, 'utf-8');
  let newContent = content;
  let changed = false;

  // Calculate relative depth from test file to repo root
  const relFromRoot = relative(ROOT, filePath);
  const dirDepth = relFromRoot.split(sep).filter(Boolean).length - 1; // exclude file
  const prefix = '../'.repeat(dirDepth);

  console.log(`Processing: ${relative(ROOT, filePath)} (dirDepth=${dirDepth}, prefix=${prefix})`);

  for (const [pkg, alias] of Object.entries(PACKAGE_MAPPINGS)) {
    // Pattern: ../../../pkg/src/... or ../../pkg/src/... etc.
    // Match both with and without trailing slash after src
    const relativePattern = `${prefix}${pkg}/src`;
    const regex = new RegExp(`(['"])${relativePattern.replace(/\//g, '\\/')}(/?)([^'"]*)(['"])`, 'g');

    newContent = newContent.replace(regex, (match, quote1, slash, path, quote2) => {
      changed = true;
      console.log(`  Replaced: ${match} -> ${quote1}${alias}/${slash}${path}${quote2}`);
      return `${quote1}${alias}/${slash}${path}${quote2}`;
    });
  }

  if (changed) {
    writeFileSync(filePath, newContent, 'utf-8');
    console.log(`Migrated: ${relative(ROOT, filePath)}`);
  }

  return changed;
}

function main() {
  const testFiles = globSync('**/*.test.ts', { cwd: TEST_DIR, absolute: true });
  console.log(`Found ${testFiles.length} test files`);

  let migrated = 0;
  for (const file of testFiles) {
    if (migrateFile(file)) migrated++;
  }

  console.log(`\nMigrated ${migrated} files`);
}

main();