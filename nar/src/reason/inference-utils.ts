import type { RuleResult } from '../rules';
import type { Task } from '../types';
import { createBudget, createTask } from '../types';

const MAX_RECENT_STAMPS = 1000;

export const exceedsDepthLimit = (task: Task, maxDepth: number): boolean =>
  task.stamp.derivations.length >= maxDepth;

export const createCircularDetector = () => {
  const recentStamps = new Set<string>();
  return {
    isCircular: (task: Task): boolean => {
      const stampId = task.stamp.id;
      if (recentStamps.has(stampId)) return true;
      if (recentStamps.size >= MAX_RECENT_STAMPS) {
        const first = recentStamps.values().next().value;
        if (first) recentStamps.delete(first);
      }
      recentStamps.add(stampId);
      return false;
    },
    reset: () => recentStamps.clear(),
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

export const createBeliefTask = (concept: {
  term: Task['term'];
  priority: number;
  beliefBag?: BeliefBagLike;
}): Task | null => {
  const belief = concept.beliefBag?.peek?.();
  if (!belief?.truth) return null;
  return createTask(concept.term, 'belief', belief.truth, createBudget(concept.priority), {
    ...(belief.stamp ? { stamp: belief.stamp } : {}),
  });
};
