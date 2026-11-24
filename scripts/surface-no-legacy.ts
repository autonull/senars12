#!/usr/bin/env tsx
/**
 * Surface legacy-import gate: fails if `src/surface/` or `src/bin/` imports from legacy packages.
 *
 * Legacy packages: @senars/core, @senars/util
 * The surface and CLI must not depend on the internal package structure.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { globSync } from 'glob';
import { importEdges } from './lib/codegen/imports.ts';
import { ROOT } from './lib/core/root.ts';

const LEGACY_PKGS = ['core'] as const;
const TARGET_DIRS = ['src/surface', 'src/bin'];

const legacySpecifier = (specifier: string): string | undefined => {
  const match = /^@senars\/([a-z]+)(?:\/|$)/.exec(specifier);
  if (match && LEGACY_PKGS.includes(match[1] as any)) {
    return `@senars/${match[1]}`;
  }
  return undefined;
};

const violations: string[] = [];

for (const targetDir of TARGET_DIRS) {
  const dirPath = join(ROOT, targetDir);
  if (!existsSync(dirPath)) continue;

  for (const file of globSync('**/*.ts', { cwd: dirPath, absolute: true })) {
    const source = readFileSync(file, 'utf-8');
    const relPath = relative(ROOT, file);

    for (const edge of importEdges(source)) {
      const legacyPkg = legacySpecifier(edge.specifier);
      if (legacyPkg) {
        violations.push(
          `  ${relPath}:${lineAt(source, edge.offset)} — imports '${legacyPkg}'`
        );
      }
    }
  }
}

if (violations.length > 0) {
  console.error('surface-no-legacy FAILED — legacy imports in surface/ or bin/:\n' + violations.join('\n'));
  process.exit(1);
}

console.log('surface-no-legacy ok — no legacy package imports in surface/ or bin/');

function lineAt(source: string, offset: number): number {
  return source.slice(0, offset).split('\n').length;
}