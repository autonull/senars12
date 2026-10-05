import { collectUpTo } from '@senars/util';
import type { Memory } from '../memory';
import { Truth } from '../terms';
import { createTask, type Task } from '../types';
import { lmTaskWeight } from './task-weights.js';

export interface ContextBeliefOptions {
  limit?: number;
  minConfidence?: number;
}

export function topBeliefTasks(memory: Memory, opts?: ContextBeliefOptions): Task[] {
  const limit = opts?.limit ?? 20;
  const minConfidence = opts?.minConfidence ?? 0;
  // `limit` bounds the tasks handed back, not the concepts read: the old
  // `listConcepts().slice(0, limit)` capped the *source*, so a run of concepts
  // with no usable belief returned fewer tasks than asked for.
  return collectUpTo(memory.listConcepts(), limit, (c) => {
    const belief = c.topBelief();
    if (!belief?.stamp) return undefined;
    if (Truth.attention(belief.truth) < minConfidence) return undefined;
    return createTask(c.term, 'belief', belief.truth, lmTaskWeight('context'), {
      stamp: belief.stamp,
    });
  });
}
