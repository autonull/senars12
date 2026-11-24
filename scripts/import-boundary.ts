#!/usr/bin/env tsx
/**
 * Import-boundary gate — the fold has no ambient I/O or entropy.
 *
 * Every effect in the fold goes through the `Env` seam: clock, RNG and IDs are
 * injected, so a seeded run replays byte-identically. This gate scans the pure
 * fold modules for the forbidden ambient sources — filesystem/network imports,
 * `Math.random()` and `Date.now()` — and fails on any *new* occurrence.
 *
 * Existing occurrences are recorded in `import-boundary-baseline.json`. It is a
 * ratchet: fixing a site and regenerating the baseline lowers it. Adding a site
 * fails until it is routed through `Env`, or the baseline is edited explicitly.
 *
 * Usage:
 *   pnpm run import:boundary            # check against baseline (fail on new)
 *   pnpm run import:boundary -- --update # re-record the baseline (only downward)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFlags } from '@senars/util/cli';
import { ROOT } from './lib/core/root.ts';
import { scanSubject } from './lib/codegen/source-scan.ts';
import { collector, report } from './lib/core/verdicts.ts';

/** The pure fold — no ambient I/O, no ambient entropy. */
const FOLD_ROOTS = [
  'src/kernel',
  'src/logics',
  'src/loop',
  'src/economy',
  'src/faculties',
  'src/admit',
  'src/mining',
] as const;

/** Files that define the seam itself, so they may name the ambient sources. */
const EXEMPT = new Set([
  'src/kernel/env.ts',
  'src/faculties/engine.ts',
  'src/faculties/judgment/judge.ts',
  'src/economy/scheduler.ts',
]);

interface Violation {
  readonly path: string;
  readonly pattern: string;
  readonly count: number;
}

const RULES: readonly { readonly pattern: string; readonly regex: RegExp; readonly detail: string }[] = [
  { pattern: 'fs', regex: /from\s+['"]node:fs(?:\/promises)?['"]|from\s+['"]fs['"]/, detail: 'filesystem import in the fold' },
  { pattern: 'net', regex: /from\s+['"]node:(?:net|http|https|dgram)['"]|from\s+['"](?:net|http|https)['"]/, detail: 'network import in the fold' },
  { pattern: 'random', regex: /\bMath\.random\s*\(/, detail: 'ambient entropy; inject `Env.rng`' },
  { pattern: 'clock', regex: /\bDate\.now\s*\(/, detail: 'ambient clock; inject `Env.clock`' },
];

const BASELINE_PATH = join(ROOT, 'scripts', 'import-boundary-baseline.json');

const countMatches = (source: string, regex: RegExp): number =>
  source.match(new RegExp(regex.source, 'g'))?.length ?? 0;

const measure = (): Violation[] => {
  const violations: Violation[] = [];
  for (const { path, source } of scanSubject(FOLD_ROOTS)) {
    if (EXEMPT.has(path)) continue;
    for (const { pattern, regex } of RULES) {
      const count = countMatches(source, regex);
      if (count > 0) violations.push({ path, pattern, count });
    }
  }
  return violations.sort((a, b) => a.path.localeCompare(b.path) || a.pattern.localeCompare(b.pattern));
};

const toBaseline = (violations: readonly Violation[]): Record<string, number> => {
  const baseline: Record<string, number> = {};
  for (const violation of violations) {
    baseline[`${violation.path}:${violation.pattern}`] = violation.count;
  }
  return baseline;
};

const readBaseline = (): Record<string, number> =>
  existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : {};

const update = parseFlags().has('--update');
const violations = measure();

if (update) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify(toBaseline(violations), null, 2)}\n`);
  console.log(`import:boundary baseline recorded — ${violations.length} site(s), ${violations.reduce((n, v) => n + v.count, 0)} occurrence(s)`);
  process.exit(0);
}

const baseline = readBaseline();
const findings = collector();
const ruleOf = (v: Violation): (typeof RULES)[number] => RULES.find((rule) => rule.pattern === v.pattern)!;

for (const violation of violations) {
  const key = `${violation.path}:${violation.pattern}`;
  const allowed = baseline[key] ?? 0;
  if (violation.count > allowed) {
    findings.fail(
      `${violation.path} [${violation.pattern}]`,
      'import-boundary',
      `${violation.count} occurrence(s), ${allowed} allowed — ${ruleOf(violation).detail}`
    );
  } else if (violation.count < allowed) {
    console.warn(`import:boundary slack — ${key} ${allowed} → ${violation.count}; re-record the baseline`);
  }
}

report('import:boundary', findings.verdicts, {
  lines: (finding) => [`${finding.at} — ${finding.detail}`],
  remedy:
    'Route the effect through `Env` (clock/RNG/IDs) or move the I/O to the oracle seam. ' +
    'If the growth is deliberate, re-record with `pnpm run import:boundary -- --update`.',
  clean: 'the fold is free of ambient I/O and entropy',
});
