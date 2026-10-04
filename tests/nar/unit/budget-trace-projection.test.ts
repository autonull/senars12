import { consumeCycles, createBudgetSlice } from '@senars/core/budget';
import { setDomainEventSink } from '@senars/core/event-sink';
import { BudgetExhaustedEventSchema } from '@senars/core/schemas';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * The budget's two event vocabularies, and the one enum both now read.
 *
 * Falsifies: "the trace projection runs on every charge even with no exporter
 * registered", and "the budget gate's own termination reasons do not all
 * validate as budget-exhaustion events".
 */
const slice = (limits = { maxCycles: 3, maxDepth: 3, maxMemoryOps: 3, maxLMCalls: 0 }) =>
  createBudgetSlice({ id: 'root', ...limits });

const collected: Array<{ name: string; scope: string; payload: Record<string, unknown> }> = [];
const record = (name: string, scope: string, payload: Record<string, unknown>) => {
  collected.push({ name, scope, payload });
};

afterEach(() => {
  setDomainEventSink(null);
  collected.length = 0;
});

describe('budget trace projection', () => {
  it('is a no-op until an exporter registers, and charges still account', () => {
    const budget = slice();
    expect(consumeCycles(budget, 2)).toBe(true);
    expect(budget.consumed.cycles).toBe(2);
    expect(collected).toHaveLength(0);
  });

  it('speaks the trace vocabulary once a sink is registered', () => {
    setDomainEventSink(record);
    const budget = slice();
    consumeCycles(budget, 1);

    expect(collected.map((event) => event.name)).toEqual([
      'budget.slice.created',
      'budget.slice.consumed',
    ]);
    expect(collected[1]!.scope).toBe('budget.slice');
    expect(collected[1]!.payload).toEqual({
      id: 'root',
      resource: 'cycles',
      amount: 1,
      consumed: 1,
      total: 3,
      pressure: expect.closeTo(1 / 3, 10),
    });
  });

  it('renames the nested counters on exhaustion, not just the top-level keys', () => {
    setDomainEventSink(record);
    const budget = slice({ maxCycles: 1, maxDepth: 1, maxMemoryOps: 1, maxLMCalls: 0 });
    // Spend the dimension, then over-spend it: the dimension's own reason is what an
    // exhausted dimension reports, and a charge that merely did not fit is the other one.
    consumeCycles(budget, 1);
    expect(consumeCycles(budget, 1)).toBe(false);

    const exhausted = collected.at(-1)!;
    expect(exhausted.name).toBe('budget.slice.exhausted');
    expect(exhausted.payload).toMatchObject({
      id: 'root',
      reason: 'cycle-budget',
      consumed: { cycles: 1, depth: 0, memory_ops: 0, llm_calls: 0 },
      total: { cycles: 1, depth: 1, memory_ops: 1, llm_calls: 0 },
    });
  });
});

describe('budget exhaustion reasons', () => {
  const event = (terminationReason: string) => ({
    type: 'budget.exhausted',
    engine: 'kernel',
    timestamp: Date.now(),
    correlationId: 'c',
    payload: { budgetType: 'cycles', remaining: 0, limit: 1, terminationReason },
  });

  it('admits every reason the accounting layer can set', () => {
    for (const reason of [
      'cycle-budget',
      'depth-budget',
      'llm-budget',
      'deadline',
      'aborted',
      'backpressure',
    ]) {
      expect(BudgetExhaustedEventSchema.safeParse(event(reason)).success).toBe(true);
    }
  });

  it('still rejects a reason that is not one of them', () => {
    expect(BudgetExhaustedEventSchema.safeParse(event('vibes')).success).toBe(false);
  });
});
