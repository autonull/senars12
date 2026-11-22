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
  mergeConsumed,
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
  consume,
  consumeCycles,
  consumeDepth,
  consumeMemoryOps,
  consumeLMCalls,
  isCapacityExhausted,
  sliceCreatedPayload,
  sliceConsumedPayload,
  sliceExhaustedPayload,
  sliceMergedPayload,
} from './budget';
export { BUDGET_TYPES, BudgetTypeSchema } from '../schemas/reasoning-budget';
export { createCapturePhase, createReflectPhase, DEFAULT_MACRO_PIPELINE, runCycle } from '../agent/phases';
export {
  ALL_RESOURCES,
  BUDGET_RESOURCES,
  type BudgetLimits,
  type BudgetResource,
  type ConsumedBudget,
  traceDimensions,
} from './budget-resources';
export type { BudgetEventMap } from './budget-events';
export { announceBudgetTrace } from './budget-otel';