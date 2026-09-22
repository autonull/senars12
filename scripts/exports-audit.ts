#!/usr/bin/env tsx
/**
 * Consumer-aware export audit (TODO20 A1).
 *
 * §5a binding rules: no speculative exports; exports are earned by consumers.
 * Every `exports` subpath declared in a package's package.json must either
 *   (a) have at least one in-repo consumer importing that exact subpath, or
 *   (b) be listed in the package's PUBLIC_API allowlist (documented surface
 *       that external packages consume, even when no in-repo file does).
 *
 * Wildcard subpaths (`./x/*`) match by prefix.
 * Exit code is non-zero when an unlisted export has no consumers — this is
 * the CI gate for "no export without a consumer".
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

/** Directories scanned for consumers (relative to repo root). */
const CONSUMER_DIRS = [
  'src',
  'nar/src',
  'io/src',
  'core/src',
  'metta/src',
  'ui/src',
  'tests',
  'examples',
  'scripts',
  'benchmarks',
];

/**
 * Documented public API: exports that are the product surface even without an
 * in-repo consumer. Anything NOT here needs a real consumer (A1 gate).
 */
const PUBLIC_API: Record<string, string[]> = {
  // The root barrel is the package's public API by definition.
  nar: ['.'],
  util: ['.'],
  core: ['.'],
  io: ['.'],
  metta: ['.'],
};

interface Options {
  packages: string[];
  verbose: boolean;
}

const parseArgs = (): Options => {
  const args = process.argv.slice(2);
  const pkgIdx = args.indexOf('--packages');
  const packages =
    pkgIdx >= 0 && args[pkgIdx + 1]
      ? args[pkgIdx + 1]!.split(',')
      : ['nar', 'util', 'core', 'io', 'metta'];
  return { packages, verbose: args.includes('--verbose') };
};

const consumerDirs = CONSUMER_DIRS.filter((d) => existsSync(join(ROOT, d)));

const loadConsumerSources = (root: string, dirs: string[]): string[] => {
  const out = execFileSync('grep', ['-rl', 'from', ...dirs], {
    cwd: root,
    maxBuffer: 64 * 1024 * 1024,
    encoding: 'utf-8',
  });
  return out.split('\n').filter(Boolean);
};

const findConsumers = (root: string, sources: string[], pkg: string, sub: string): string[] => {
  const name = sub === '.' ? '' : sub.replace(/^\.\//, '').replace(/\/\*$/, '');
  const prefix = `@senars/${pkg}${name ? `/${name}` : ''}`;
  // Prefix match with a path boundary: './lm/system-one' is consumed by
  // `@senars/nar/lm/system-one/head-specs.js` too (deep files under the entry).
  return sources.filter((file) => {
    const text = readFileSync(join(root, file), 'utf-8');
    const re = new RegExp(
      sub === '.' ? `['"]${prefix}['"]` : `['"]${prefix.replace(/\./g, '\\.')}(/[^'"]*)?['"]`
    );
    return re.test(text);
  });
};

/** Audit the given packages under root; returns violation descriptions. */
export const auditPackages = (
  root: string,
  packages: string[],
  consumerDirs: string[] = CONSUMER_DIRS.filter((d) => existsSync(join(root, d)))
): string[] => {
  const sources = loadConsumerSources(root, consumerDirs);
  const violations: string[] = [];

  for (const pkg of packages) {
    const pkgPath = join(root, pkg, 'package.json');
    if (!existsSync(pkgPath)) continue;
    const { exports } = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
      exports?: Record<string, unknown>;
    };
    if (!exports) continue;
    const allowlist = PUBLIC_API[pkg] ?? [];

    for (const sub of Object.keys(exports)) {
      const consumers = findConsumers(root, sources, pkg, sub);
      if (consumers.length === 0 && !allowlist.includes(sub)) {
        violations.push(`${pkg}: export "${sub}" has no consumer and is not in PUBLIC_API`);
      }
    }
  }
  return violations;
};

const main = (): void => {
  const { packages, verbose } = parseArgs();
  const violations = auditPackages(ROOT, packages);
  if (verbose) {
    for (const pkg of packages) {
      const pkgPath = join(ROOT, pkg, 'package.json');
      if (!existsSync(pkgPath)) continue;
      const { exports } = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
        exports?: Record<string, unknown>;
      };
      for (const sub of Object.keys(exports ?? {})) {
        const n = findConsumers(
          ROOT,
          loadConsumerSources(
            ROOT,
            CONSUMER_DIRS.filter((d) => existsSync(join(ROOT, d)))
          ),
          pkg,
          sub
        ).length;
        console.log(`  ${pkg}${sub} — ${n} consumer(s)`);
      }
    }
  }

  if (violations.length > 0) {
    console.error(`✗ exports-audit: ${violations.length} violation(s)`);
    for (const v of violations) console.error(`  - ${v}`);
    console.error(
      '\nEither add a consumer, remove the export, or declare it in PUBLIC_API (scripts/exports-audit.ts).'
    );
    process.exit(1);
  }
  console.log(
    `✓ exports-audit ok — every declared export has a consumer or is declared public API`
  );
};

main();
