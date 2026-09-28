#!/usr/bin/env tsx
/**
 * Export-boundary verification.
 *
 * Verifies that every `exports` subpath declared in each `@senars/*` package's
 * package.json resolves to a real file on disk. This catches the class of
 * "stale export" bug where a file was deleted/moved but its package.json
 * `exports` entry was left dangling (e.g. the `core/events` / `ui/agent-bridge`
 * regressions fixed during the NEXT.clean plan).
 *
 * It intentionally does NOT enforce which symbols a package may export — that
 * requires static analysis of the type graph and is out of scope. This is a
 * cheap, dependency-free guard for the most common regression.
 *
 * Exit code is non-zero when any dangling export is found, so it can be wired
 * as a CI gate.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entryTargets, readPackageJson } from './lib/pkg.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const PACKAGES = ['util', 'core', 'nar', 'io', 'metta', 'ui'];

function isDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}


/**
 * A wildcard target like `./src/agent/*.ts` is a glob, not a literal file.
 * Resolve the static prefix (everything before `*.ts`) and verify that base
 * directory exists — the package may export any concrete module beneath it.
 */
function resolveTarget(pkgRoot: string, target: string): { abs: string; isWildcard: boolean } {
  const abs = join(pkgRoot, target);
  const idx = target.indexOf('*');
  if (idx === -1) return { abs, isWildcard: false };
  const base = join(pkgRoot, target.slice(0, idx));
  return { abs: base, isWildcard: true };
}

function checkPackage(pkgDir: string): string[] {
  const pkg = readPackageJson(root, pkgDir);
  if (!pkg || !pkg.exports) return [];
  const problems: string[] = [];
  const pkgRoot = join(root, pkgDir);

  for (const [subpath, entry] of Object.entries(pkg.exports)) {
    if (subpath === '.') continue;
    const targets = entryTargets(entry);
    if (targets.length === 0) {
      problems.push(`${pkgDir}: export "${subpath}" has no resolvable target`);
      continue;
    }
    for (const target of targets) {
      const { abs, isWildcard } = resolveTarget(pkgRoot, target);
      if (!existsSync(abs)) {
        problems.push(`${pkgDir}: export "${subpath}" -> "${target}" does not exist`);
        continue;
      }
      if (!isWildcard && isDirectory(abs)) {
        problems.push(
          `${pkgDir}: export "${subpath}" -> "${target}" resolves to a directory, not a file`
        );
      }
    }
  }
  return problems;
}

const allProblems: string[] = [];
for (const pkg of PACKAGES) {
  const problems = checkPackage(pkg);
  if (problems.length > 0) {
    allProblems.push(...problems);
  } else {
    console.log(`ok  ${pkg}`);
  }
}

if (allProblems.length > 0) {
  console.error('\nFAILED: dangling package exports detected:');
  for (const p of allProblems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log('\nAll package export subpaths resolve to real files.');
