import {
  ALL_RESOURCES,
  BUDGET_RESOURCES,
  BUDGET_TYPES,
  budgetLimit,
  budgetRemaining,
} from '@senars/core/budget';
import {
  BUDGET_SCOPE_IDS,
  BUDGET_SCOPES,
  scopeLimitKey,
  scopeTerminationReason,
} from '@senars/nar/kernel/budget-scopes';
import { ControlBudgets } from '@senars/nar/kernel/control-budgets';
import {
  createDefaultReasoningBudget,
  KernelBudgetGate,
} from '@senars/nar/kernel/KernelBudgetGate';
import { describe, expect, it } from 'vitest';

describe('the gate spends the budget core accounts', () => {
  it('an operation spends the dimension core/budget names for it', () => {
    const gate = new KernelBudgetGate();
    const before = gate.getBudget();

    gate.check({ operation: 'lm-call', estimatedCost: 4 });
    gate.check({ operation: 'memory-op', estimatedCost: 3 });

    const after = gate.getBudget();
    expect(after.consumed.llmCalls).toBe(before.consumed.llmCalls + 4);
    expect(after.consumed.memoryOps).toBe(before.consumed.memoryOps + 3);
    expect(after.consumed.cycles).toBe(before.consumed.cycles);
  });

  it('the refused dimension, not the operation name, decides the reason and the event type', () => {
    const gate = new KernelBudgetGate({
      defaultBudget: { ...createDefaultReasoningBudget(), maxLMCalls: 1 },
    });

    const granted = gate.check({ operation: 'lm-call', estimatedCost: 1 });
    expect(granted.granted).toBe(true);

    // One more unit than is left: the dimension is spent, so the reason is its own.
    const refused = gate.check({ operation: 'lm-call', estimatedCost: 5 });
    expect(refused.granted).toBe(false);
    expect(refused.terminationReason).toBe(BUDGET_RESOURCES.llmCalls.reason);
    expect(gate.getBudget().terminationReason).toBe(BUDGET_RESOURCES.llmCalls.reason);

    // A cost that simply does not fit is backpressure, not exhaustion.
    const tooBig = new KernelBudgetGate({
      defaultBudget: { ...createDefaultReasoningBudget(), maxCycles: 3 },
    });
    expect(tooBig.check({ operation: 'nal-step', estimatedCost: 2 }).granted).toBe(true);
    expect(tooBig.check({ operation: 'nal-step', estimatedCost: 9 }).terminationReason).toBe(
      'backpressure'
    );
  });

  it('isExhausted reports on every dimension, and not on the four the gate happens to name', () => {
    const gate = new KernelBudgetGate({
      defaultBudget: {
        maxCycles: 1,
        maxDepth: 1,
        maxMemoryOps: 1,
        maxLMCalls: 1,
        consumed: zeroSpent(),
      },
    });
    expect(gate.isExhausted()).toBe(false);

    gate.check({ operation: 'derivation-depth', estimatedCost: 1 });
    expect(gate.isExhausted()).toBe(true);
    expect(gate.isExhausted('derivation-depth')).toBe(true);
    expect(gate.isExhausted('lm-call')).toBe(false);
    // An operation the gate does not declare spends nothing, so it cannot be exhausted.
    expect(gate.isExhausted('never-declared')).toBe(false);

    for (const resource of ALL_RESOURCES) {
      expect(BUDGET_TYPES[resource]).toBeTruthy();
      expect(budgetLimit(gate.getBudget(), resource)).toBe(1);
    }
  });
});

describe('a control scope declares its dimension and inherits the rest', () => {
  it('the ceiling key and the overflow reason come from the dimension, not the row', () => {
    for (const scopeId of BUDGET_SCOPE_IDS) {
      const { consumedKey } = BUDGET_SCOPES[scopeId];
      expect(scopeLimitKey(scopeId)).toBe(BUDGET_RESOURCES[consumedKey].total);
      expect(scopeTerminationReason(scopeId)).toBe(BUDGET_RESOURCES[consumedKey].reason);
    }
  });

  it('a scope raised on one dimension leaves the others at the base ceiling', () => {
    const gate = new KernelBudgetGate();
    new ControlBudgets(gate).beginCycle();

    const scoped = gate.getScopeBudget('proposal-application');
    expect(scoped?.consumed).toEqual(zeroSpent());
    expect(budgetRemaining(scoped!, 'memoryOps')).toBe(
      BUDGET_SCOPES['proposal-application'].defaultLimit
    );
    // The dimensions the scope never spends inherit the gate's, so it cannot trip one.
    expect(budgetRemaining(scoped!, 'cycles')).toBe(gate.getBudget().maxCycles);
  });
});

const zeroSpent = () => ({ cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 });
