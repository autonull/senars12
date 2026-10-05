import type { Task } from '../types/core.js';
import { canonicalTerm } from './reduce.js';
import { Truth } from './impls/Truth.js';

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

/**
 * `--x. %f%;c%` and `x. %(1−f)%;c%` are **one claim** spelled twice, and nothing
 * above the term layer can say so — a term holds no truth. The negation moves
 * into the truth, never the other way: `negationElim`, `implicationIntro` and
 * `classical.syllogismNegation` all key a premise on `term.kind === 'negation'`,
 * so a form that emptied the negation bucket would silently disable three
 * registered rules, and one that invented a negation at every head below half
 * frequency would empty the `inheritance` bucket — where the table's hottest 21
 * rules live. A doubted claim keeps the spelling its author gave it.
 */
const negationIntoTruth: TaskReducer = {
  id: 'negation-into-truth',
  applies: (task) => task.term.kind === 'negation' && task.term.args?.[0]?.kind !== 'negation',
  reduce: (task) => ({
    ...task,
    term: task.term.args![0]!,
    truth: Truth.negation(task.truth),
  }),
};

export const TASK_REDUCERS: readonly TaskReducer[] = Object.freeze([negationIntoTruth]);

const MAX_PASSES = 4;

/**
 * Canonicalisation at task construction, so a claim cannot reach memory in two
 * spellings. The stamp, the budget and the occurrence time carry through
 * untouched: this is the same claim with a different surface, not a revision.
 */
export const canonicalTask = (task: Task): Task => {
  let current = task;
  // A loop over `TASK_REDUCERS`, not `reduce` over it: this runs on every task and every
  // secondary premise, and the closure plus accumulator plumbing were two allocations per
  // call for a table with one row. The "nothing rewrote it" early exit is unchanged.
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let next = current;
    for (const reducer of TASK_REDUCERS) {
      if (reducer.applies(next)) next = reducer.reduce(next);
    }
    if (next === current) return current;
    current = { ...next, term: canonicalTerm(next.term) };
  }
  throw new Error(`canonicalTask did not reach a fixed point in ${MAX_PASSES} passes: ${task.term}`);
};
