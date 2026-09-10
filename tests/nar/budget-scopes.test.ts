import { describe, expect, it } from 'vitest';
import { KernelBudgetGate } from '../../nar/src/kernel/KernelBudgetGate.js';

describe('todo7: scoped budgets', () => {
  it('scopes isolate counters; shared default untouched', () => {
    const gate = new KernelBudgetGate({ defaultBudget: { maxCycles: 2, maxDepth: 10, maxMemoryOps: 10, maxLMCalls: 1, consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 } } });
    expect(gate.check({ operation: 'nal-step', scopeId: 'a' }).granted).toBe(true);
    expect(gate.check({ operation: 'nal-step', scopeId: 'a' }).granted).toBe(true);
    expect(gate.check({ operation: 'nal-step', scopeId: 'a' }).granted).toBe(false);
    expect(gate.check({ operation: 'nal-step', scopeId: 'b' }).granted).toBe(true);
    expect(gate.check({ operation: 'nal-step' }).granted).toBe(true);
  });
  it('releaseScope drops counters; resetBudget clears all scopes', () => {
    const gate = new KernelBudgetGate({ defaultBudget: { maxCycles: 1, maxDepth: 10, maxMemoryOps: 10, maxLMCalls: 1, consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 } } });
    expect(gate.check({ operation: 'nal-step', scopeId: 'a' }).granted).toBe(true);
    expect(gate.check({ operation: 'nal-step', scopeId: 'a' }).granted).toBe(false);
    gate.releaseScope('a');
    expect(gate.check({ operation: 'nal-step', scopeId: 'a' }).granted).toBe(true);
    gate.resetBudget();
    expect(gate.getScopeBudget('a')).toBeUndefined();
  });
});
