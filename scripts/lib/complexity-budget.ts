/**
 * Complexity Budget Gate (REFACTOR.todo4 Phase E).
 *
 * Reads existing metrics (exports-audit, deps-gate, cloc, typecheck:bin, AIKR coverage)
 * and compares against checked-in baseline. Fails on regression.
 *
 * The baselines are ceilings, and a ceiling that is never lowered is not a
 * ratchet — it is a number that was correct once. Both `productionLOC` and
 * `circularChains` sat thousands of units above their measurements for
 * several passes, so they could not have failed. The rule name is
 * `mustNotIncrease` rather than `mustDecreaseOrJustify` because that is what
 * the comparison does; the obligation to move the baseline is a commit-time
 * one, and the failure message says so.
 *
 * `circularChains` counts dpdm's `circular` report over *all* edges, while
 * `deps:gate` counts the same report with `--transform`, which erases
 * type-only edges. The two are different graphs of the same tree, so the
 * ledger's metric was named for the gate while measuring something the gate
 * deliberately excludes: a baseline written when it tracked `deps:gate` then
 * compared against 26 cycles and failed, and the name implied a coupling that
 * does not exist. Both budgets are worth keeping — runtime cycles break
 * initialisation order, type-only cycles cost import coupling — so the metric
 * now says which graph it reads.
 *
 * Measurement and verdict are separate exports because they cost wildly
 * different amounts: measuring shells out to cloc, dpdm and tsc, while
 * comparing nine numbers against a baseline is arithmetic. The gate needs both;
 * a test that falsifies the verdict for each metric needs the comparison
 * against nine *mutated* baselines and the measurement exactly once.
 */

import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { ACCUMULATOR_LEDGER } from './accumulator-ledger.js';
import { circularChainsAsync } from './dpdm.js';
import { readExports } from './pkg.js';
import { ROOT } from './root.js';
import { productionSources, WORKSPACE_SOURCE_ROOTS } from './source-scan.js';

const execFileAsync = promisify(execFile);

export interface Baseline {
  exportSubpaths: number;
  productionLOC: number;
  appendOnlyPersistenceSites: number;
  aikrProcessorCoverage: number;
  unboundedAccumulatorSites: number;
  accumulatorsAudited: number;
  circularChains: number;
  typecheckBinErrors: number;
  workspaceCount: number;
}

export interface CurrentMetrics extends Baseline {}

export interface BudgetConfig {
  version: number;
  baseline: Baseline;
  rules: Record<string, string>;
}

export interface MetricRow {
  metric: string;
  baseline: number;
  current: number;
  status: 'PASS' | 'FAIL';
  rule: string;
}

export interface Verdict {
  rows: MetricRow[];
  failed: boolean;
}

const PACKAGES = ['nar', 'util', 'core', 'io', 'metta'];

const SOURCE_ROOTS = WORKSPACE_SOURCE_ROOTS;

export const readBudget = (path: string): BudgetConfig =>
  JSON.parse(readFileSync(path, 'utf-8')) as BudgetConfig;

/**
 * Matching lines across a set of sources. Three of the metrics below are
 * line-pattern counts over the same ~600 production files, and shelling out to
 * `grep` per metric meant re-walking the tree per metric — and one of those
 * greps was a shell pipeline whose quoting was broken, so the metric it fed had
 * been silently reporting its fallback for as long as the gate existed.
 */
const countLines = (sources: readonly string[], pattern: RegExp): number => {
  let count = 0;
  for (const source of sources) {
    for (const line of source.split('\n')) if (pattern.test(line)) count++;
  }
  return count;
};

const countExportSubpaths = (): number =>
  PACKAGES.reduce((total, pkg) => total + Object.keys(readExports(ROOT, pkg)).length, 0);

const countProductionLOC = async (): Promise<number> => {
  try {
    const { stdout } = await execFileAsync('pnpm', ['dlx', 'cloc', '--json', ...SOURCE_ROOTS]);
    return (JSON.parse(stdout.trim()) as { SUM?: { code?: number } }).SUM?.code ?? 0;
  } catch {
    return 0;
  }
};

/** A `Ledger` import site, or a bespoke append outside the ledger implementation. */
const LEDGER_IMPORT_RE = /from.*['"]\.\.\/.*ledger|from.*['"]@senars\/io.*ledger|import.*Ledger/;
const BESPOKE_APPEND_RE = /fs\.appendFile|appendFileSync/;

const countAppendOnlyPersistenceSites = (): number => {
  const sources = productionSources()
    .filter((file) => !file.replaceAll('\\', '/').includes('util/src/ledger'))
    .map((file) => readFileSync(file, 'utf-8'));
  // Each Ledger instance is a site; bespoke appends are separate sites.
  return Math.max(
    1,
    countLines(sources, LEDGER_IMPORT_RE) > 0 ? 1 + countLines(sources, BESPOKE_APPEND_RE) : 12
  );
};

const countAIKRProcessorCoverage = (): number =>
  countLines(
    productionSources(['nar/src']).map((file) => readFileSync(file, 'utf-8')),
    /new AIKRProcessor/
  );

/**
 * Ledger entries whose container is not capacity-bounded. The audited set is
 * `ACCUMULATOR_LEDGER` — see that module for why it is data and not a scan.
 */
const countUnboundedAccumulatorSites = (): number =>
  ACCUMULATOR_LEDGER.filter(({ file }) => {
    const path = join(ROOT, file);
    if (!existsSync(path)) return true;
    const content = readFileSync(path, 'utf-8');
    return !content.includes('LruCache') || !/LruCache\(\{[^}]*maxSize/.test(content);
  }).length;

const countTypecheckBinErrors = async (): Promise<number> => {
  try {
    await execFileAsync('npx', ['tsc', '--noEmit', '-p', 'tsconfig.bin.json'], { cwd: ROOT });
    return 0;
  } catch (err) {
    // tsc reports diagnostics on stdout, not stderr; count every `error TS` line.
    const { stdout = '', stderr = '' } = (err as { stdout?: string; stderr?: string }) ?? {};
    return (`${stdout}\n${stderr}`.match(/error TS\d+/g) ?? []).length;
  }
};

const countCircularChains = async (): Promise<number> => {
  try {
    return (await circularChainsAsync({ transform: false })).length;
  } catch {
    return 999; // failure indicator
  }
};

const countWorkspaces = (): number => {
  const wsPath = join(ROOT, 'pnpm-workspace.yaml');
  if (!existsSync(wsPath)) return 0;
  const content = readFileSync(wsPath, 'utf-8');
  // Only count packages under the "packages:" section, before "allowBuilds:" or "minimumReleaseAgeExclude:"
  let inPackages = false;
  let count = 0;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === 'packages:') {
      inPackages = true;
      continue;
    }
    if (
      inPackages &&
      (trimmed.startsWith('allowBuilds:') || trimmed.startsWith('minimumReleaseAgeExclude:'))
    ) {
      break;
    }
    if (inPackages && trimmed.startsWith('- ')) count++;
  }
  return count;
};

/**
 * Every current metric, with the three that shell out measured concurrently:
 * cloc, dpdm and tsc are independent and together cost more than the whole
 * rest of the gate, so running them one after another billed the gate the sum
 * of the three instead of the largest.
 */
export const measureCurrent = async (): Promise<CurrentMetrics> => {
  const [productionLOC, circularChains, typecheckBinErrors] = await Promise.all([
    countProductionLOC(),
    countCircularChains(),
    countTypecheckBinErrors(),
  ]);

  return {
    exportSubpaths: countExportSubpaths(),
    productionLOC,
    appendOnlyPersistenceSites: countAppendOnlyPersistenceSites(),
    aikrProcessorCoverage: countAIKRProcessorCoverage(),
    unboundedAccumulatorSites: countUnboundedAccumulatorSites(),
    accumulatorsAudited: ACCUMULATOR_LEDGER.length,
    circularChains,
    typecheckBinErrors,
    workspaceCount: countWorkspaces(),
  };
};

type RuleName = keyof Baseline;

/** One budgeted metric: its name, its baseline, its measurement, and how it is judged. */
interface Rule {
  readonly metric: string;
  readonly name: RuleName;
}

const RULES: readonly Rule[] = [
  { metric: 'Export subpaths', name: 'exportSubpaths' },
  { metric: 'Production LOC', name: 'productionLOC' },
  { metric: 'Append-only persistence sites', name: 'appendOnlyPersistenceSites' },
  { metric: 'AIKRProcessor coverage', name: 'aikrProcessorCoverage' },
  { metric: 'Unbounded accumulator sites', name: 'unboundedAccumulatorSites' },
  { metric: 'Accumulators audited', name: 'accumulatorsAudited' },
  { metric: 'Circular chains', name: 'circularChains' },
  { metric: 'typecheck:bin errors', name: 'typecheckBinErrors' },
  { metric: 'Workspace count', name: 'workspaceCount' },
];

/** The `mustNotIncrease` / `mustNotDecrease` / fixed comparison each rule name declares. */
const PASSES: Record<RuleName, (baseline: number, current: number) => boolean> = {
  exportSubpaths: (b, c) => c <= b,
  productionLOC: (b, c) => c <= b,
  appendOnlyPersistenceSites: (b, c) => c <= b,
  aikrProcessorCoverage: (b, c) => c >= b,
  unboundedAccumulatorSites: (_b, c) => c === 0,
  accumulatorsAudited: (b, c) => c >= b,
  circularChains: (b, c) => c <= b,
  typecheckBinErrors: (_b, c) => c === 0,
  workspaceCount: (b, c) => c === b,
};

/**
 * Compare a measurement against a baseline. The nine rules are data, not code,
 * so a falsification test can mutate one number and read back the row it broke.
 */
export const compare = (budget: BudgetConfig, current: CurrentMetrics): Verdict => {
  const rows = RULES.map(({ metric, name }): MetricRow => {
    const baseline = budget.baseline[name];
    return {
      metric,
      baseline,
      current: current[name],
      status: PASSES[name](baseline, current[name]) ? 'PASS' : 'FAIL',
      rule: budget.rules[name] ?? '',
    };
  });
  return { rows, failed: rows.some(({ status }) => status === 'FAIL') };
};

const BORDER =
  '│ Metric                              │ Baseline │ Current │ Status│ Rule                           │';

export const renderTable = (rows: readonly MetricRow[]): string =>
  [
    '┌─────────────────────────────────────┬──────────┬─────────┬───────┬────────────────────────────────┐',
    BORDER,
    '├─────────────────────────────────────┼──────────┼─────────┼───────┼────────────────────────────────┤',
    ...rows.map(
      ({ metric, baseline, current, status, rule }) =>
        `│ ${metric.padEnd(35)} │ ${`${baseline}`.padStart(8)} │ ${`${current}`.padStart(7)} │ ${status.padEnd(5)} │ ${rule.padEnd(32)} │`
    ),
    '└─────────────────────────────────────┴──────────┴─────────┴───────┴────────────────────────────────┘',
  ].join('\n');

export const REGRESSION_MESSAGE =
  '\n✗ complexity-budget: REGRESSION DETECTED — one or more metrics exceeded baseline\n' +
  '  A `mustNotIncrease` rule only ratchets if the baseline moves with it: when a\n' +
  '  metric goes down, lower its baseline in the same commit. complexity-budget.json is the ledger.';
