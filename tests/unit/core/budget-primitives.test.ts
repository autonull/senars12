import {
  ALL_RESOURCES,
  BUDGET_RESOURCES,
  BUDGET_TYPES,
  type BudgetResource,
  budgetAffords,
  budgetLimit,
  budgetLimitsOf,
  budgetPressure,
  budgetRefusal,
  budgetRemaining,
  chargeBudget,
  createBudget,
  zeroConsumed,
} from '@senars/core/budget';
import { describe, expect, it } from 'vitest';

const LIMITS = { maxCycles: 2, maxDepth: 3, maxMemoryOps: 4, maxLMCalls: 5 };
const budget = (limits = LIMITS) => createBudget(limits);

describe('core/budget — the four AIKR dimensions have one arithmetic', () => {
  it('every dimension names its own ceiling key and exhaustion reason', () => {
    const spent = budget({ maxCycles: 0, maxDepth: 0, maxMemoryOps: 0, maxLMCalls: 0 });
    expect(ALL_RESOURCES).toEqual(Object.keys(BUDGET_RESOURCES));
    for (const resource of ALL_RESOURCES) {
      const { total, reason } = BUDGET_RESOURCES[resource];
      expect(budgetLimit(budget(), resource)).toBe(budget()[total]);
      expect(budgetRefusal(spent, resource)).toBe(reason);
    }
  });

  it('each dimension has one event-level name, and a fresh budget has spent nothing', () => {
    expect(BUDGET_TYPES).toEqual({
      cycles: 'cycles',
      depth: 'depth',
      memoryOps: 'memory',
      llmCalls: 'llm',
    });
    expect(createBudget(LIMITS).consumed).toEqual(zeroConsumed());
    expect(budgetLimitsOf(budget())).toEqual({
      maxCycles: 2,
      maxDepth: 3,
      maxMemoryOps: 4,
      maxLMCalls: 5,
    });
  });

  it('remaining, affordability and pressure are read from the same totals', () => {
    const b = budget();
    chargeBudget(b, 'cycles', 1);

    expect(budgetRemaining(b, 'cycles')).toBe(1);
    expect(budgetAffords(b, 'cycles', 1)).toBe(true);
    expect(budgetAffords(b, 'cycles', 2)).toBe(false);
    expect(budgetPressure(b, 'cycles')).toBeCloseTo(0.5);
    // Untouched dimensions report their own ceiling, not a neighbour's.
    expect(budgetRemaining(b, 'llmCalls')).toBe(5);
    expect(budgetPressure(b, 'llmCalls')).toBe(0);
  });

  it('a refused charge names the dimension only once it is spent', () => {
    const b = budget();
    // Fits, so nothing is refused: the gate reports backpressure for a charge that
    // did not fit rather than claiming the dimension ran out.
    expect(budgetAffords(b, 'cycles', 3)).toBe(false);
    expect(budgetRefusal(b, 'cycles')).toBe('backpressure');

    chargeBudget(b, 'cycles', 2);
    expect(budgetRemaining(b, 'cycles')).toBe(0);
    expect(budgetRefusal(b, 'cycles')).toBe(BUDGET_RESOURCES.cycles.reason);
  });

  it('a dimension nothing was spent on is unpressured', () => {
    expect(budgetPressure(budget(), 'memoryOps')).toBe(0);
  });
});
