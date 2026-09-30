/**
 * Bench 99 — Complexity Budget Gate Falsification
 *
 * Verifies that the complexity-budget gate fails on injected regressions
 * for each of the six metrics and passes on the current tree.
 *
 * Falsifying a budget rule means mutating the *baseline*, and the tree measures
 * the same either way — so the measurement and the two CLI runs are taken once,
 * concurrently, and each case then re-runs only the comparison. Ten serial
 * subprocess invocations of the gate, each re-shelling out to cloc, dpdm and
 * tsc, made this the slowest file in the suite by a wide margin and proved
 * nothing the comparison does not already prove.
 */

import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type Baseline,
  type BudgetConfig,
  type CurrentMetrics,
  compare,
  type MetricRow,
  measureCurrent,
  readBudget,
  renderTable,
} from '../../scripts/lib/complexity-budget.js';
import { ROOT } from '../../scripts/lib/root.js';

const execFileAsync = promisify(execFile);

describe('Bench 99 — complexity budget gate', () => {
  const original = readBudget(join(ROOT, 'complexity-budget.json'));
  let current: CurrentMetrics;
  let passing: GateRun;
  let regressed: GateRun;
  let scratchDir: string;

  interface GateRun {
    code: number;
    stdout: string;
  }

  /**
   * The gate reads its budget from a scratch file: mutating the checked-in one
   * races other vitest workers and can leave the tree dirty when a run dies.
   */
  const runCli = async (name: string, budget: BudgetConfig): Promise<GateRun> => {
    const budgetPath = join(scratchDir, `${name}.json`);
    writeFileSync(budgetPath, JSON.stringify(budget, null, 2));
    try {
      const { stdout } = await execFileAsync(
        'tsx',
        ['scripts/complexity-budget.ts', '--budget', budgetPath],
        { cwd: ROOT, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 120_000 }
      );
      return { code: 0, stdout };
    } catch (err) {
      const { code, stdout } = err as { code?: number; stdout?: string };
      return { code: code ?? 1, stdout: stdout ?? '' };
    }
  };

  beforeAll(async () => {
    scratchDir = mkdtempSync(join(tmpdir(), 'budget-'));
    [current, passing, regressed] = await Promise.all([
      measureCurrent(),
      runCli('passing', original),
      runCli('regressed', { ...original, baseline: { ...original.baseline, productionLOC: 1 } }),
    ]);
  }, 180_000);

  afterAll(() => rmSync(scratchDir, { recursive: true, force: true }));

  const runGate = (mutate: (baseline: Baseline) => void) => {
    const budget: BudgetConfig = { ...original, baseline: { ...original.baseline } };
    mutate(budget.baseline);
    return compare(budget, current);
  };

  const rowOf = ({ rows }: ReturnType<typeof runGate>, metric: string): MetricRow => {
    const row = rows.find((r) => r.metric === metric);
    if (!row) throw new Error(`no budget row named '${metric}'`);
    return row;
  };

  it('fails when export subpaths increase', () => {
    const result = runGate((b) => {
      b.exportSubpaths = 10; // artificially low baseline
    });
    expect(result.failed).toBe(true);
    expect(rowOf(result, 'Export subpaths').status).toBe('FAIL');
  });

  it('fails when production LOC increases', () => {
    const result = runGate((b) => {
      b.productionLOC = 1000; // artificially low baseline
    });
    expect(result.failed).toBe(true);
    expect(rowOf(result, 'Production LOC').status).toBe('FAIL');
  });

  it('fails when append-only persistence sites increase', () => {
    const result = runGate((b) => {
      b.appendOnlyPersistenceSites = 1; // artificially low baseline
    });
    expect(result.failed).toBe(true);
    expect(rowOf(result, 'Append-only persistence sites').status).toBe('FAIL');
  });

  it('fails when AIKRProcessor coverage decreases', () => {
    const result = runGate((b) => {
      b.aikrProcessorCoverage = 10; // artificially high baseline
    });
    expect(result.failed).toBe(true);
    expect(rowOf(result, 'AIKRProcessor coverage').status).toBe('FAIL');
  });

  it('holds every audited accumulator site bounded', () => {
    // The rule is an absolute `=== 0` check, so it cannot be induced from the
    // config. Assert the real invariant instead: the declared ledger is fully
    // bounded, and an empty ledger cannot pass as coverage.
    const result = runGate(() => {});
    expect(rowOf(result, 'Unbounded accumulator sites')).toMatchObject({
      status: 'PASS',
      current: 0,
    });
    expect(rowOf(result, 'Accumulators audited').current).toBeGreaterThan(0);
  });

  it('fails when the audited accumulator set shrinks', () => {
    const result = runGate((b) => {
      b.accumulatorsAudited = 99; // more sites than the ledger can hold
    });
    expect(result.failed).toBe(true);
    expect(rowOf(result, 'Accumulators audited').status).toBe('FAIL');
  });

  it('fails when circular chains increase', () => {
    const result = runGate((b) => {
      b.circularChains = 1; // artificially low baseline
    });
    expect(result.failed).toBe(true);
    expect(rowOf(result, 'Circular chains').status).toBe('FAIL');
  });

  it('holds typecheck:bin at zero — the bin/CLI surface typechecks clean', () => {
    // The rule is an absolute `=== 0` check that ignores the baseline, so it cannot be induced
    // from the config. Assert the real invariant instead: reintroducing a bin type error fails here.
    const result = runGate(() => {});
    expect(rowOf(result, 'typecheck:bin errors')).toMatchObject({ status: 'PASS', current: 0 });
  });

  it('fails when workspace count changes', () => {
    const result = runGate((b) => {
      b.workspaceCount = 99; // wrong count
    });
    expect(result.failed).toBe(true);
    expect(rowOf(result, 'Workspace count').status).toBe('FAIL');
  });

  it('exits zero and emits a parseable table on the checked-in budget', () => {
    expect(passing.code).toBe(0);
    expect(passing.stdout).toContain('┌');
    expect(passing.stdout).toContain('│ Metric');
    expect(passing.stdout).toContain('└');
  });

  it('exits non-zero from the CLI on an injected regression', () => {
    expect(regressed.code).toBe(1);
    expect(regressed.stdout).toContain('Production LOC');
    expect(regressed.stdout).toContain('FAIL');
  });

  it('reports one row, and one verdict, per budgeted metric', () => {
    const { rows } = runGate(() => {});
    const table = renderTable(rows);
    expect(rows).toHaveLength(9);
    for (const { metric, status } of rows) {
      expect(table).toContain(`│ ${metric.padEnd(35)} │`);
      expect(table).toContain(`│ ${status.padEnd(5)} │`);
    }
  });
});
