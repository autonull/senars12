#!/usr/bin/env tsx
/**
 * One-Oracle gate — all external/nondeterministic calls go through the oracle seam.
 *
 * Every `fetch`, `child_process` spawn for external engines, and similar ambient
 * I/O in src/ must go through `src/oracles/`. This gate scans for violations and
 * fails on any *new* occurrence.
 *
 * Existing occurrences are recorded in `one-oracle-baseline.json`. It is a
 * ratchet: fixing a site and regenerating the baseline lowers it. Adding a site
 * fails until it is routed through the oracle seam, or the baseline is edited
 * explicitly.
 *
 * Usage:
 *   pnpm run one:oracle            # check against baseline (fail on new)
 *   pnpm run one:oracle -- --update # re-record the baseline (only downward)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseFlags } from '@senars/util/cli';
import { ROOT } from './lib/root.js';
import { scanSubject } from './lib/source-scan.js';
import { collector, report } from './lib/verdicts.js';

/** The source roots to scan — everything under src/ except exempt paths. */
const SCAN_ROOTS = ['src'] as const;

/** Files/paths that define the seam itself or are legitimate transports/entry points. */
const EXEMPT = new Set([
  // Oracle seam definition
  'src/oracles/oracle.ts',
  'src/oracles/index.ts',
  'src/oracles/engines/index.ts',
  'src/oracles/engines/tau-prolog.ts',
  'src/oracles/engines/z3.ts',
  'src/oracles/engines/clingo.ts',
  'src/oracles/engines/minisat.ts',
  'src/oracles/lm.ts',
  'src/oracles/retrieval.ts',
  'src/oracles/pins.ts',
  'src/oracles/memo.ts',
  // Transport layer — legitimate network I/O
  'src/surface/transports/http.ts',
  'src/surface/transports/index.ts',
  'src/surface/transports/ws.ts',
  // CLI entry points — user-facing commands
  'src/bin/commands/runtime.ts',
]);

interface Violation {
  readonly path: string;
  readonly pattern: string;
  readonly count: number;
  readonly lines: readonly number[];
}

const RULES: readonly { readonly pattern: string; readonly regex: RegExp; readonly detail: string }[] = [
  {
    pattern: 'fetch',
    regex: /\bfetch\s*\(/,
    detail: 'direct fetch call outside oracle seam; route through src/oracles/',
  },
  {
    pattern: 'child_process-import',
    regex: /from\s+['"]node:child_process['"]|from\s+['"]child_process['"]/,
    detail: 'child_process import outside oracle engines; route through src/oracles/engines/',
  },
];

const BASELINE_PATH = join(ROOT, 'scripts', 'one-oracle-baseline.json');

const countMatches = (source: string, regex: RegExp): { count: number; lines: number[] } => {
  const lines = source.split('\n');
  const matchedLines: number[] = [];
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    const matches = lines[i].match(new RegExp(regex.source, 'g'));
    if (matches) {
      count += matches.length;
      matchedLines.push(i + 1); // 1-based line numbers
    }
  }
  return { count, lines: matchedLines };
};

const measure = (): Violation[] => {
  const violations: Violation[] = [];
  for (const { path, source } of scanSubject(SCAN_ROOTS)) {
    const relPath = relative(ROOT, path);
    if (EXEMPT.has(relPath)) continue;
    for (const { pattern, regex } of RULES) {
      const { count, lines } = countMatches(source, regex);
      if (count > 0) violations.push({ path: relPath, pattern, count, lines });
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
  console.log(
    `one:oracle baseline recorded — ${violations.length} site(s), ${violations.reduce((n, v) => n + v.count, 0)} occurrence(s)`
  );
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
      'one-oracle',
      `${violation.count} occurrence(s) at line(s) ${violation.lines.join(', ')}, ${allowed} allowed — ${ruleOf(violation).detail}`
    );
  } else if (violation.count < allowed) {
    console.warn(`one:oracle slack — ${key} ${allowed} → ${violation.count}; re-record the baseline`);
  }
}

report('one:oracle', findings.verdicts, {
  lines: (finding) => [finding.detail],
  remedy:
    'Route the external call through the oracle seam (src/oracles/). ' +
    'If the growth is deliberate, re-record with `pnpm run one:oracle -- --update`.',
  clean: 'all external calls go through the oracle seam',
});