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
  const tasks: Task[] = [];
  for (const c of memory.listConcepts().slice(0, limit)) {
    const belief = c.beliefBag.peek();
    if (!belief?.truth || !belief.stamp) continue;
    if (Truth.attention(belief.truth) < minConfidence) continue;
    tasks.push(
      createTask(c.term, 'belief', belief.truth, lmTaskWeight('context'), {
        stamp: belief.stamp,
      })
    );
  }
  return tasks;
}
