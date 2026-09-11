import type {Memory} from '../memory';
import {createBudget, type Task} from '../types';
import {createTimestamp} from '../types/core.js';

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
        if (belief.truth.f * belief.truth.c < minConfidence) continue;
        tasks.push({
            term: c.term,
            type: 'belief',
            truth: belief.truth,
            budget: createBudget(0.5, 0.8),
            stamp: belief.stamp,
            occurrenceTime: createTimestamp(),
            derived: false,
        });
    }
    return tasks;
}
