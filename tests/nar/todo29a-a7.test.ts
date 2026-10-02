import { describe, expect, it } from 'vitest';

import type { BudgetSubject } from '../../scripts/lib/control-budgets.js';
import { budgetViolations, sharedOperations, spentScopeIds } from '../../scripts/lib/control-budgets.js';
import {
  BUDGET_SCOPE_IDS,
  BUDGET_SCOPES,
  DECISION_DERIVATIONS_SCOPE,
  scopeBudget,
  scopeSpec,
  type BudgetScopeId,
} from '@senars/nar/kernel/budget-scopes';
import { ControlBudgets, type ControlBudgetOverrides } from '@senars/nar/kernel/control-budgets';
import { createGateRegistry } from '@senars/nar/kernel/GateRegistry';
import { termParser } from '@senars/nar/terms';
import { Truth } from '@senars/nar/terms/impls/Truth';
import { createDefaultReasoningBudget, KernelBudgetGate } from '@senars/nar/kernel/KernelBudgetGate';
import { DEFAULT_CONFIG, Memory, RuleProcessor, TaskManager } from '@senars/nar';
import { NARExecution } from '@senars/nar/nar-execution';
import { createTestController, inferenceParams } from './fixtures/cognitive.js';

/** Derivation count per cycle — what the decision budget must not move. */
const derivationCount = async (overrides: ControlBudgetOverrides): Promise<number> => {
  const memory = new Memory({
    maxConcepts: 100,
    activationDecayRate: 0.01,
    consolidationInterval: 10,
  });
  for (const narsese of ['(a-->b).', '(b-->c).']) {
    memory.addTask(termParser.parse(narsese), 'belief', Truth.TRUE, undefined, undefined);
  }
  const gates = createGateRegistry();
  gates.initialize({ initialBudget: createDefaultReasoningBudget() });
  const execution = new NARExecution({
    gates,
    budgets: new ControlBudgets(gates.getBudgetGate() as KernelBudgetGate, overrides),
    memory,
    taskManager: new TaskManager(memory, { gateRegistry: gates }),
    config: DEFAULT_CONFIG,
    cognitiveController: createTestController(memory, inferenceParams(3), undefined, new RuleProcessor()),
  });
  return execution.run(2);
};

const base = createDefaultReasoningBudget();

/** A subject over the real declaration, with spends the caller controls. */
const subject = (overrides: Partial<BudgetSubject> = {}): BudgetSubject => ({
  scopeIds: BUDGET_SCOPE_IDS,
  spends: BUDGET_SCOPE_IDS.map((scopeId) => ({ at: 'nar/src/x.ts:1', scopeId })),
  declaredOperations: [...new Set(BUDGET_SCOPE_IDS.map((id) => BUDGET_SCOPES[id].operation))],
  ...overrides,
});

describe('the gate can fail', () => {
  it('names a scope nothing spends and a spend that names nothing', () => {
    const violations = budgetViolations(
      subject({
        scopeIds: BUDGET_SCOPE_IDS,
        spends: [
          { at: 'nar/src/a.ts:1', scopeId: 'premises' },
          { at: 'nar/src/b.ts:2', scopeId: 'invented-scope' },
        ],
      })
    );

    expect(violations.map((v) => v.rule).sort()).toEqual([
      'unknown-scope',
      'unspent-scope',
      'unspent-scope',
      'unspent-scope',
      'unspent-scope',
      'unspent-scope',
    ]);
    expect(violations.find((v) => v.rule === 'unknown-scope')?.detail).toContain('invented-scope');
  });

  it('names a scope whose operation the schema does not have', () => {
    const violations = budgetViolations(subject({ declaredOperations: ['premise-selection'] }));

    expect(violations.map((v) => v.detail)).toEqual([
      expect.stringContaining("scope 'derivations' declares operation 'derivation'"),
      expect.stringContaining("scope 'candidate-derivations' declares operation 'candidate-derivation'"),
      expect.stringContaining("scope 'proposal-application' declares operation 'proposal-application'"),
      expect.stringContaining("scope 'control-work' declares operation 'control-work'"),
      expect.stringContaining("scope 'decision-derivations' declares operation 'decision-derivation'"),
    ]);
  });

  it('names two scopes claiming one operation', () => {
    expect(sharedOperations(BUDGET_SCOPES, BUDGET_SCOPE_IDS)).toEqual([]);
    // The check is over the table, so a collision is expressed as data.
    const colliding = { ...BUDGET_SCOPES, premises: { ...BUDGET_SCOPES.premises, operation: 'derivation' } };
    expect(sharedOperations(colliding, Object.keys(colliding))).toEqual(['derivation']);
  });

  it('a fully spent, fully declared subject is clean', () => {
    expect(budgetViolations(subject())).toEqual([]);
    expect(spentScopeIds([{ at: 'x:1', scopeId: 'derivations' }])).toEqual(['derivations']);
  });
});

describe('A7 — every declared scope is one ReasoningBudget scope', () => {
  it('each carries an owner, a default, a configuration source and an overflow reason', () => {
    for (const scopeId of BUDGET_SCOPE_IDS) {
      const spec = scopeSpec(scopeId);
      expect([spec.owner, spec.configSource, spec.terminationReason].every(Boolean)).toBe(true);
      expect(spec.defaultLimit).toBeGreaterThan(0);
    }
  });

  it('the derived scope spends its declared dimension and no other', () => {
    const gate = new KernelBudgetGate();
    const budgets = new ControlBudgets(gate);
    budgets.beginCycle();

    expect(budgets.charge('derivations', 3)).toBe(true);
    expect(gate.getScopeBudget('derivations')?.consumed).toEqual({
      cycles: 3,
      depth: 0,
      memoryOps: 0,
      llmCalls: 0,
    });
  });

  it('an exhausted scope denies with its declared reason, and re-opens each cycle', () => {
    const gate = new KernelBudgetGate();
    const budgets = new ControlBudgets(gate, { derivations: 2 });
    budgets.beginCycle();

    expect([budgets.charge('derivations'), budgets.charge('derivations'), budgets.charge('derivations')]).toEqual([
      true,
      true,
      false,
    ]);
    expect(gate.getEventLog().at(-1)?.payload.terminationReason).toBe('cycle-budget');

    budgets.beginCycle();
    expect(budgets.charge('derivations')).toBe(true);
  });

  it('a scope of zero denies from the first charge', () => {
    const budgets = new ControlBudgets(new KernelBudgetGate(), { 'decision-derivations': 0 });
    budgets.beginCycle();

    expect(budgets.charge('decision-derivations')).toBe(false);
  });

  it('the inherited dimensions come from the base budget, not from another scope', () => {
    const budget = scopeBudget('derivations', base, { derivations: 7 });

    expect(budget.maxCycles).toBe(7);
    expect(budget.maxDepth).toBe(base.maxDepth);
    expect(budget.consumed).toEqual({ cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 });
  });
});

describe('A7 — the decision layer has its own scope, and it does not touch S', () => {
  it('decision-derivations is a distinct scopeId from the symbolic derivation scope', () => {
    expect(DECISION_DERIVATIONS_SCOPE).toBe('decision-derivations');
    expect(DECISION_DERIVATIONS_SCOPE).not.toBe('derivations');
    expect(BUDGET_SCOPES[DECISION_DERIVATIONS_SCOPE].consumedKey).not.toBe(
      BUDGET_SCOPES.derivations.consumedKey
    );
  });

  it('a zero decision budget leaves the symbolic derivation count unchanged', async () => {
    const [spent, untouched] = await Promise.all([
      derivationCount({ 'decision-derivations': 0 }),
      derivationCount({}),
    ]);

    expect(untouched).toBeGreaterThan(0);
    expect(spent).toBe(untouched);
  });
});

describe('A7 — the per-cycle reads are bounded control work', () => {
  it('a spent control-work budget stops the reads rather than running them unbudgeted', () => {
    const budgets = new ControlBudgets(new KernelBudgetGate(), { 'control-work': 2 });
    budgets.beginCycle();

    expect([budgets.charge('control-work'), budgets.charge('control-work'), budgets.charge('control-work')]).toEqual([
      true,
      true,
      false,
    ]);
  });
});

describe('A7 — a NAR built without a composition root still has declared budgets', () => {
  it('the default registry-backed execution charges the same scopes', () => {
    const gates = createGateRegistry();
    gates.initialize({ initialBudget: createDefaultReasoningBudget() });
    const budgets = new ControlBudgets(gates.getBudgetGate() as KernelBudgetGate);
    budgets.beginCycle();

    expect(budgets.charge('proposal-application')).toBe(true);
  });
});
