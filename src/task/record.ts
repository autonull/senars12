/**
 * The task boundary — one record shape and one rehydrator for every path that
 * turns a persisted task back into a live one (memory snapshots, NAR state
 * files, event replay, query).
 *
 * Each caller used to pick its own default budget, truth, stamp, and occurrence
 * time, so a round trip lost a different field depending on which door the task
 * came through, and a parse failure was caught (or not) once per caller.
 */

import { finiteOr } from '@senars/util/numeric';
import { deserializeStamp, type SerializedStamp, type Stamp, serializeStamp } from '../terms/impls/Stamp';
import { Stamp as StampFactory } from '../terms/impls/Stamp';
import { Truth } from '../terms/impls/Truth';
import { TASK_PUNCTUATION, taskTypeForPunctuation } from '../schemas/task';
import { termParser } from '../terms/index';
import type { Term } from '../terms';
import type { TaskOverrides } from '../types/core';
import type { TermTruth } from '../types/truth';
import {
  createTask,
  createTaskWeight,
  NEUTRAL_BUDGET,
  type Task,
  type TaskType,
} from '../types/index';
import type { Timestamp } from '../types/primitives';

/**
 * The punctuation table lives with the grammar that reads it
 * (`terms/impls/parser-peggy`), so rendering a task and parsing it back cannot
 * disagree — which they did, over the command mark.
 */
export { TASK_PUNCTUATION as PUNCTUATION_BY_TASK_TYPE };

/** Task type named by Narsese sentence punctuation; `fallback` when absent or unrecognised. */
export const taskTypeFromPunctuation = (punctuation: string, fallback: TaskType): TaskType =>
  taskTypeForPunctuation(punctuation) ?? fallback;

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

export const serializeTaskRecord = (task: Task): TaskRecord => ({
  term: task.term.toString(),
  type: task.type,
  truth: task.truth ? { f: task.truth.f, c: task.truth.c } : undefined,
  budget: task.budget.priority,
  stamp: serializeStamp(task.stamp),
  occurrenceTime: task.occurrenceTime,
});

/** Live task from its record, or `null` when the term no longer parses. Restoring a
 * stamp also advances the mint counter past its id, so a reloaded stamp can never
 * collide with a newly minted one.
 */
export const rehydrateTask = (
  record: TaskRecord,
  fallbackType: TaskType = 'belief'
): Task | null => {
  let term: Term;
  try {
    term = termParser.parse(record.term);
  } catch {
    return null;
  }

  const overrides: TaskOverrides = {
    stamp: record.stamp ? deserializeStamp(record.stamp) : StampFactory.createInput(),
  };
  if (record.occurrenceTime !== undefined) {
    overrides.occurrenceTime = record.occurrenceTime as Timestamp;
  }

  return createTask(
    term,
    record.type ?? fallbackType,
    Truth.fromUnknown(record.truth, Truth.NEUTRAL),
    createTaskWeight(finiteOr(record.budget, NEUTRAL_BUDGET.priority)),
    overrides
  );
};
