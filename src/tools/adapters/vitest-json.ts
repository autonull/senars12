/**
 * The single reader for vitest/coverage JSON output. Vitest interleaves plain
 * text with its JSON document, so every consumer used to re-implement the same
 * "find the first `{` line" fence scan and the same four counter reductions.
 */

import { parseJsonObject, safeRatio } from '@senars/util';

export type CoverageMetrics = {
  total: number;
  covered: number;
  pct: number;
};

export interface VitestResult {
  success: boolean;
  passed: number;
  failed: number;
  total: number;
  duration: number;
  tests: Array<{
    name: string;
    state: 'pass' | 'fail' | 'skip';
    duration: number;
    errors?: string[];
  }>;
  coverage?: Record<'lines' | 'statements' | 'functions' | 'branches', CoverageMetrics>;
}

export interface FileCoverage {
  path: string;
  lines: CoverageMetrics;
  statements: CoverageMetrics;
  functions: CoverageMetrics;
  branches: CoverageMetrics;
}

interface Counters {
  total: number;
  covered: number;
}

const METRIC_KEYS = ['lines', 'statements', 'functions', 'branches'] as const;
type MetricKey = (typeof METRIC_KEYS)[number];

const pct = (c: Counters): CoverageMetrics => ({
  total: c.total,
  covered: c.covered,
  pct: safeRatio(c.covered, c.total) * 100,
});

const emptyCounters = (): Counters => ({ total: 0, covered: 0 });

const addCounts = (into: Counters, counts: unknown): void => {
  for (const count of Object.values((counts ?? {}) as Record<string, number>)) {
    into.total++;
    if (count > 0) into.covered++;
  }
};

/**
 * Reduce one file's `l`/`s`/`f`/`b` hit maps. Lines fall back to statements when
 * a reporter omits line data (istanbul's default shape).
 */
export function fileCoverageMetrics(
  file: Record<string, unknown>
): Record<'lines' | 'statements' | 'functions' | 'branches', CoverageMetrics> {
  const lines = emptyCounters();
  const statements = emptyCounters();
  const functions = emptyCounters();
  const branches = emptyCounters();
  addCounts(lines, file.l);
  addCounts(statements, file.s);
  addCounts(functions, file.f);
  addCounts(branches, file.b);
  return {
    lines: pct(lines.total > 0 ? lines : statements),
    statements: pct(statements),
    functions: pct(functions),
    branches: pct(branches),
  };
}

const metricsAdd = (a: Counters, b: Counters): Counters => ({
  total: a.total + b.total,
  covered: a.covered + b.covered,
});

/** Parse the JSON document vitest writes, ignoring any leading plain-text lines. */
export function parseVitestJson(output: string): Record<string, any> | null {
  return parseJsonObject(output);
}

export function parseCoverageFiles(output: string): FileCoverage[] {
  const data = parseVitestJson(output);
  if (!data?.coverageMap) return [];
  return Object.entries(data.coverageMap as Record<string, Record<string, unknown>>).map(
    ([path, file]) => ({ path, ...fileCoverageMetrics(file) })
  );
}

export function parseVitestResult(output: string): VitestResult | null {
  const data = parseVitestJson(output);
  if (!data) return null;

  let duration = 0;
  for (const suite of data.testResults ?? []) {
    duration += (suite.endTime ?? 0) - (suite.startTime ?? 0);
  }

  let coverage: VitestResult['coverage'];
  if (data.coverageMap) {
    const totals: Record<MetricKey, Counters> = {
      lines: emptyCounters(),
      statements: emptyCounters(),
      functions: emptyCounters(),
      branches: emptyCounters(),
    };
    for (const file of Object.values(data.coverageMap as Record<string, Record<string, unknown>>)) {
      const metrics = fileCoverageMetrics(file);
      for (const key of METRIC_KEYS) totals[key] = metricsAdd(totals[key], metrics[key]);
    }
    coverage = {
      lines: pct(totals.lines),
      statements: pct(totals.statements),
      functions: pct(totals.functions),
      branches: pct(totals.branches),
    };
  }

  return {
    success: data.success,
    passed: data.numPassedTests ?? 0,
    failed: data.numFailedTests ?? 0,
    total: data.numTotalTests ?? 0,
    duration,
    tests:
      data.testResults?.flatMap((suite: any) =>
        suite.assertionResults?.map((t: any) => ({
          name: t.fullName,
          state: t.status === 'passed' ? 'pass' : t.status === 'failed' ? 'fail' : 'skip',
          duration: t.duration,
          errors: t.failureMessages,
        }))
      ) ?? [],
    coverage,
  };
}
