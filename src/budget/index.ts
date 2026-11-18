/**
 * Budget — budget management (migrated from @senars/core/budget).
 */

export { createBudget } from '@senars/core/budget';
export { createCapturePhase, DEFAULT_MACRO_PIPELINE } from '@senars/core/agent/phases';
export {
  ALL_RESOURCES,
  BUDGET_RESOURCES,
  type BudgetSlice,
  type BudgetLimits,
  type ConsumedBudget,
  type BudgetResource,
  isExhausted,
  pressure,
  remainingAll,
  traceDimensions,
} from '@senars/core/budget';