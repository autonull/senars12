import { BoundedMap } from '@senars/util';

import type { RuleInput, RuleResult } from '../rules';
import { termKey } from '../terms';
import type { Task } from '../types';
import { createBeliefTask, createBudget, createTask } from '../types';

const MAX_RECENT_CONCLUSIONS = 1000;

export const exceedsDepthLimit = (task: Task, maxDepth: number): boolean =>
  task.stamp.derivations.length >= maxDepth;

/** A task in the shape the rule engine consumes. */
export const toRuleInput = (task: Task): RuleInput => ({
  term: task.term,
  truth: task.truth,
  stamp: task.stamp,
});

/**
 * A conclusion repeats when the same evidence produced the same term and truth.
 * The stamp alone is not an identity: every task an LM rule derives from one
 * premise pair shares that pair's stamp, so keying on it discarded all but the
 * first candidate of a multi-candidate proposal.
 */
const conclusionKey = (task: Task): string =>
  `${task.stamp.id}|${termKey(task.term)}|${task.truth.f}:${task.truth.c}`;

export const createCircularDetector = () => {
  const recent = new BoundedMap<string, true>({
    maxSize: MAX_RECENT_CONCLUSIONS,
    eviction: 'fifo',
  });
  return {
    isCircular: (task: Task): boolean => {
      const key = conclusionKey(task);
      if (recent.has(key)) return true;
      recent.set(key, true);
      return false;
    },
    reset: () => recent.clear(),
  };
};

export const createDerivedTask = (result: RuleResult, taskType: Task['type'] = 'belief'): Task =>
  createTask(result.term, taskType, result.truth, createBudget(result.priority), {
    stamp: result.stamp,
    derived: true,
  });

interface BeliefBagLike {
  peek?: () => { truth?: Task['truth']; stamp?: Task['stamp'] } | undefined;
}

/** A concept's strongest belief as a task, or `null` when it holds no truth. */
export const createBeliefTaskFromConcept = (concept: {
  term: Task['term'];
  priority: number;
  beliefBag?: BeliefBagLike;
}): Task | null => {
  const belief = concept.beliefBag?.peek?.();
  if (!belief?.truth) return null;
  return createBeliefTask(concept.term, belief.truth, concept.priority, belief.stamp);
};
