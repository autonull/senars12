/**
 * Task type definition — extracted to break reduce-task.ts <-> types/core.ts cycle.
 */

import type { Term } from '../terms/types.js';
import type { Truth } from '../terms/impls/Truth.js';
import type { Stamp } from '../terms/impls/Stamp.js';
import type { Timestamp } from './primitives.js';
import type { Budget, TaskType } from '@senars/core/schemas';

// Core Task interface
export interface Task {
  readonly term: Term;
  readonly type: TaskType;
  readonly truth: Truth;
  readonly budget: Budget;
  readonly stamp: Stamp;
  readonly occurrenceTime: Timestamp;
  readonly derived: boolean;
}