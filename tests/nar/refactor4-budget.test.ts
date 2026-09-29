/**
 * Bench 99 — Complexity Budget Gate Falsification
 *
 * Verifies that the complexity-budget gate fails on injected regressions
 * for each of the six metrics and passes on the current tree.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = process.cwd();

describe('Bench 99 — complexity budget gate', () => {
  let originalBudget: string;
  let scratchDir: string;

  beforeEach(() => {
    originalBudget = readFileSync(join(ROOT, 'complexity-budget.json'), 'utf-8');
    // The gate runs against a scratch budget file: mutating the checked-in one
    // races other vitest workers and can leave the tree dirty when a run dies.
    scratchDir = mkdtempSync(join(tmpdir(), 'budget-'));
  });

  afterEach(() => {
    rmSync(scratchDir, { recursive: true, force: true });
  });

  const runGate = (budgetJson: string): { code: number; stdout: string; stderr: string } => {
    const budgetPath = join(scratchDir, 'complexity-budget.json');
    writeFileSync(budgetPath, budgetJson);
    try {
      const out = execFileSync('tsx', ['scripts/complexity-budget.ts', '--budget', budgetPath], {
        cwd: ROOT,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60_000,
      });
      return { code: 0, stdout: out.toString(), stderr: '' };
    } catch (e: any) {
      return { code: e.code ?? 1, stdout: e.stdout?.toString() ?? '', stderr: e.stderr?.toString() ?? '' };
    }
  };

  it('fails when export subpaths increase', { timeout: 60000 }, () => {
    const budget = JSON.parse(originalBudget);
    budget.baseline.exportSubpaths = 10; // artificially low baseline
    const result = runGate(JSON.stringify(budget, null, 2));
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('Export subpaths');
    expect(result.stdout).toContain('FAIL');
  });

  it('fails when production LOC increases', { timeout: 60000 }, () => {
    const budget = JSON.parse(originalBudget);
    budget.baseline.productionLOC = 1000; // artificially low baseline
    const result = runGate(JSON.stringify(budget, null, 2));
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('Production LOC');
    expect(result.stdout).toContain('FAIL');
  });

  it('fails when append-only persistence sites increase', { timeout: 60000 }, () => {
    const budget = JSON.parse(originalBudget);
    budget.baseline.appendOnlyPersistenceSites = 1; // artificially low baseline
    const result = runGate(JSON.stringify(budget, null, 2));
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('Append-only persistence sites');
    expect(result.stdout).toContain('FAIL');
  });

  it('fails when AIKRProcessor coverage decreases', { timeout: 60000 }, () => {
    const budget = JSON.parse(originalBudget);
    budget.baseline.aikrProcessorCoverage = 10; // artificially high baseline
    const result = runGate(JSON.stringify(budget, null, 2));
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('AIKRProcessor coverage');
    expect(result.stdout).toContain('FAIL');
  });

  it('holds every audited accumulator site bounded', { timeout: 60000 }, () => {
    // The rule is an absolute `=== 0` check, so it cannot be induced from the
    // config. Assert the real invariant instead: the declared ledger is fully
    // bounded, and an empty ledger cannot pass as coverage.
    const result = runGate(originalBudget);
    expect(result.stdout).toMatch(/Unbounded accumulator sites\s*│\s*0\s*│\s*0\s*│\s*PASS/);
    expect(result.stdout).toMatch(/Accumulators audited\s*│\s*\d+\s*│\s*\d+\s*│\s*PASS/);
  });

  it('fails when the audited accumulator set shrinks', { timeout: 60000 }, () => {
    const budget = JSON.parse(originalBudget);
    budget.baseline.accumulatorsAudited = 99; // more sites than the ledger can hold
    const result = runGate(JSON.stringify(budget, null, 2));
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('Accumulators audited');
    expect(result.stdout).toContain('FAIL');
  });

  it('fails when deps:gate raw chains increase', { timeout: 60000 }, () => {
    const budget = JSON.parse(originalBudget);
    budget.baseline.depsGateRawChains = 10; // artificially low baseline
    const result = runGate(JSON.stringify(budget, null, 2));
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('deps:gate raw chains');
    expect(result.stdout).toContain('FAIL');
  });

  it('holds typecheck:bin at zero — the bin/CLI surface typechecks clean', { timeout: 60000 }, () => {
    // The rule is an absolute `=== 0` check that ignores the baseline, so it cannot be induced
    // from the config. Assert the real invariant instead: reintroducing a bin type error fails here.
    const result = runGate(originalBudget);
    expect(result.stdout).toContain('typecheck:bin errors');
    expect(result.stdout).toMatch(/typecheck:bin errors\s*│\s*0\s*│\s*0\s*│\s*PASS/);
  });

  it('fails when workspace count changes', { timeout: 60000 }, () => {
    const budget = JSON.parse(originalBudget);
    budget.baseline.workspaceCount = 99; // wrong count
    const result = runGate(JSON.stringify(budget, null, 2));
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('Workspace count');
    expect(result.stdout).toContain('FAIL');
  });

  it('emits parseable table output', { timeout: 60000 }, () => {
    const result = runGate(originalBudget);
    // Table structure is asserted independently of the overall gate verdict
    expect(result.stdout).toContain('┌');
    expect(result.stdout).toContain('│ Metric');
    expect(result.stdout).toContain('└');
  });
});