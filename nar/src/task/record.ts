/**
 * The task boundary — one record shape and one rehydrator for every path that
 * turns a persisted task back into a live one (memory snapshots, NAR state
 * files, event replay, query).
 *
 * Each caller used to pick its own default budget, truth, stamp, and occurrence
 * time, so a round trip lost a different field depending on which door the task
 * came through, and a parse failure was caught (or not) once per caller.
 */

import {
  type SerializedStamp,
  type Stamp,
  Stamp as StampFactory,
  Truth,
  deserializeStamp,
  serializeStamp,
  termParser,
  type Term,
} from '../terms/index.js';
import {
  type Task,
  type TaskType,
  createBudget,
  createTask,
  NEUTRAL_BUDGET,
} from '../types/index.js';
import type { TaskOverrides } from '../types/core.js';
import type { Timestamp } from '../types/primitives.js';

/** Narsese sentence punctuation per task type; the inverse of {@link taskTypeFromPunctuation}. */
export const PUNCTUATION_BY_TASK_TYPE: Readonly<Record<TaskType, string>> = Object.freeze({
  belief: '.',
  goal: '!',
  question: '?',
  command: '@',
});

const TYPE_BY_PUNCTUATION: ReadonlyMap<string, TaskType> = new Map(
  Object.entries(PUNCTUATION_BY_TASK_TYPE).map(([type, mark]) => [mark, type as TaskType])
);

/** Task type named by Narsese sentence punctuation; `fallback` when absent or unrecognised. */
export const taskTypeFromPunctuation = (punctuation: string, fallback: TaskType): TaskType =>
  TYPE_BY_PUNCTUATION.get(punctuation) ?? fallback;

/** A task as it crosses a persistence or event boundary. Every field is optional but the type. */
export interface TaskRecord {
  readonly term: string;
  readonly type?: TaskType;
  readonly truth?: { readonly f: number; readonly c: number };
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

const finiteOr = (value: number | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/**
 * Live task from its record, or `null` when the term no longer parses. Restoring a
 * stamp also advances the mint counter past its id, so a reloaded stamp can never
 * collide with a newly minted one.
 */
export const rehydrateTask = (record: TaskRecord, fallbackType: TaskType = 'belief'): Task | null => {
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
    record.truth ? Truth.create(record.truth.f, record.truth.c) : Truth.NEUTRAL,
    createBudget(finiteOr(record.budget, NEUTRAL_BUDGET.priority)),
    overrides
  );
};
