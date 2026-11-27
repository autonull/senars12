/**
 * Task type definition — extracted to break reduce-task.ts <-> types/core.ts cycle.
 */
import type { Term } from '../terms/types';
import type { Truth } from '../terms/impls/Truth';
import type { Stamp } from '../terms/impls/Stamp';
import type { Timestamp } from './primitives';
import type { Budget, TaskType } from '@senars/schemas';
export interface Task {
    readonly term: Term;
    readonly type: TaskType;
    readonly truth: Truth;
    readonly budget: Budget;
    readonly stamp: Stamp;
    readonly occurrenceTime: Timestamp;
    readonly derived: boolean;
}
//# sourceMappingURL=task.d.ts.map