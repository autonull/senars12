/**
 * Budget — budget management (migrated from @senars/core/budget).
 */

export { createBudget, snapshotBudget, zeroConsumed, createBudgetSlice, isExhausted, pressure, remainingAll, remainingCycles, type BudgetSlice } from './budget.js';
export { createCapturePhase, createReflectPhase, DEFAULT_MACRO_PIPELINE } from '../agent/phases.js';
export {
  ALL_RESOURCES,
  BUDGET_RESOURCES,
  type BudgetLimits,
  type BudgetResource,
  type ConsumedBudget,
  traceDimensions,
} from './budget-resources.js';
export type { BudgetEventMap } from './budget-events.js';
export { announceBudgetTrace } from './budget-otel.js';