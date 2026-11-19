/**
 * Budget — budget management (migrated from @senars/budget).
 */

export {
  createBudget,
  snapshotBudget,
  zeroConsumed,
  createBudgetSlice,
  isExhausted,
  pressure,
  remainingAll,
  remainingCycles,
  type BudgetSlice,
  type AIKRBudget,
  mergeConsumption,
  sliceBudget,
  type BudgetSliceOptions,
  freshBudget,
  type BudgetAllocation,
  resolveAllocation,
  chargeAllocation,
  type BudgetEventBus,
  budgetLimitsOf,
  budgetLimit,
  budgetRemaining,
  budgetAffords,
  budgetPressure,
  budgetRefusal,
  chargeBudget,
  consumeCycles,
  consumeDepth,
  consumeMemoryOps,
  consumeLMCalls,
  isCapacityExhausted,
  sliceCreatedPayload,
  sliceConsumedPayload,
  sliceExhaustedPayload,
  sliceMergedPayload,
} from './budget.js';
export { BUDGET_TYPES, BudgetTypeSchema } from '../schemas/index.js';
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