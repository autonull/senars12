import type { Task } from '../types/task';
/**
 * One rewrite over a *claim* rather than a formula (TODO29.a §5.12), with the
 * same two obligations as {@link TermReducer}: `applies` is false for every
 * canonical task, and the reducers commute to a fixed point.
 */
export interface TaskReducer {
    readonly id: string;
    applies(task: Task): boolean;
    reduce(task: Task): Task;
}
export declare const TASK_REDUCERS: readonly TaskReducer[];
/**
 * Canonicalisation at task construction, so a claim cannot reach memory in two
 * spellings. The stamp, the budget and the occurrence time carry through
 * untouched: this is the same claim with a different surface, not a revision.
 */
export declare const canonicalTask: (task: Task) => Task;
//# sourceMappingURL=reduce-task.d.ts.map