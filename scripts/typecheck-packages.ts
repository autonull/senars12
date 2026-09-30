#!/usr/bin/env tsx
/**
 * Workspace typecheck gate.
 *
 * The root `tsc` covers `src/` and `tests/` and nothing else. Each package has
 * its own `tsconfig.json`, and no gate ran them — so ~85k lines inside `core`,
 * `nar`, `io`, `metta` and `util` reached the complexity budget, the dependency
 * graph and the export audit without the compiler ever seeing them. A deliberate
 * `const x: number = "s"` planted in `nar/src` produced no root error.
 *
 * Each package keeps its own `tsconfig.json` as the source of truth; this runs
 * them all and reports every failure before exiting, so one broken package does
 * not hide the next.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fromRoot } from './lib/root.js';

/** Packages whose sources ship into the runtime the kernel gates guard. */
const PACKAGES = ['util', 'core', 'io', 'metta', 'nar'] as const;

/**
 * `ui` is excluded deliberately: it carries 4 pre-existing errors
 * (`lm-status-panel.ts` imports a `$lmStatus` member `ui/src/client/core` does
 * not export). It has its own `typecheck` script and its own build, and fixing
 * the frontend is not this gate's business — but the exclusion is recorded here
 * rather than left implicit so it cannot quietly outlive its reason.
 */
const EXCLUDED = ['ui'];

const tsc = (pkg: string): { ok: boolean; output: string } => {
  const result = spawnSync('pnpm', ['exec', 'tsc', '--noEmit', '-p', 'tsconfig.json'], {
    cwd: fromRoot(pkg),
    encoding: 'utf-8',
  });
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
};

const declared = (): string[] => {
  const raw = readFileSync(fromRoot('pnpm-workspace.yaml'), 'utf-8');
  const block = raw.split('packages:')[1]?.split(/\n(?=[a-z])/)[0] ?? '';
  return [...block.matchAll(/^\s*-\s*'?([\w./-]+)'?\s*$/gm)].map((m) => m[1]);
};

const undeclared = PACKAGES.filter((pkg) => !declared().includes(pkg));
if (undeclared.length > 0) {
  console.error(
    `typecheck:packages FAILED — ${undeclared.join(', ')} typed but absent from pnpm-workspace.yaml`
  );
  process.exit(1);
}

const missing = PACKAGES.filter((pkg) => !existsSync(join(fromRoot(pkg), 'tsconfig.json')));
if (missing.length > 0) {
  console.error(`typecheck:packages FAILED — no tsconfig.json in ${missing.join(', ')}`);
  process.exit(1);
}

const results = PACKAGES.map((pkg) => ({ pkg, ...tsc(pkg) }));
const failed = results.filter((r) => !r.ok);

if (failed.length > 0) {
  console.error(
    `typecheck:packages FAILED — ${failed.map((r) => r.pkg).join(', ')} (${EXCLUDED.join(', ')} excluded)`
  );
  for (const r of failed) console.error(`\n--- ${r.pkg} ---\n${r.output}`);
  process.exit(1);
}

console.log(
  `typecheck:packages — ${PACKAGES.length} packages clean (${EXCLUDED.join(', ')} excluded)`
);
