/**
 * Task and Budget types
 * Re-exports from core types to maintain domain organization
 */

// Re-export from core to maintain single source of truth
export type {
  Task,
  TaskType,
  Budget
} from '../types/core.js';

export {
  createBudget,
  createTask,
  isBudget,
  getBudgetValue
} from '../types/core.js';
