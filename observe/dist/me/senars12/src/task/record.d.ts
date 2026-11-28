/**
 * The task boundary — one record shape and one rehydrator for every path that
 * turns a persisted task back into a live one (memory snapshots, NAR state
 * files, event replay, query).
 *
 * Each caller used to pick its own default budget, truth, stamp, and occurrence
 * time, so a round trip lost a different field depending on which door the task
 * came through, and a parse failure was caught (or not) once per caller.
 */
import { type SerializedStamp, type Stamp } from '../terms/impls/Stamp';
import { TASK_PUNCTUATION } from '../schemas/task';
import type { TermTruth } from '../types/truth';
import { type Task, type TaskType } from '../types/index';
/**
 * The punctuation table lives with the grammar that reads it
 * (`terms/impls/parser-peggy`), so rendering a task and parsing it back cannot
 * disagree — which they did, over the command mark.
 */
export { TASK_PUNCTUATION as PUNCTUATION_BY_TASK_TYPE };
/** Task type named by Narsese sentence punctuation; `fallback` when absent or unrecognised. */
export declare const taskTypeFromPunctuation: (punctuation: string, fallback: TaskType) => TaskType;
/** A task as it crosses a persistence or event boundary. Every field is optional but the type. */
export interface TaskRecord {
    readonly term: string;
    readonly type?: TaskType;
    readonly truth?: TermTruth;
    /** Budget priority, not a whole budget — durability and quality are policy, not state. */
    readonly budget?: number;
    readonly stamp?: SerializedStamp | Stamp;
    readonly occurrenceTime?: number;
}
export declare const serializeTaskRecord: (task: Task) => TaskRecord;
/** Live task from its record, or `null` when the term no longer parses. Restoring a
 * stamp also advances the mint counter past its id, so a reloaded stamp can never
 * collide with a newly minted one.
 */
export declare const rehydrateTask: (record: TaskRecord, fallbackType?: TaskType) => Task | null;
//# sourceMappingURL=record.d.ts.map