/**
 * Belief revision and deduplication utilities
 */

import type {TaskData} from './concept.js';
import type {Truth} from '../terms';
import {TermMap, termsEqual} from '../terms';
import {Truth as TruthOps} from '../terms/truth.js';

export interface RevisionResult {
    revised: Truth;
    evidenceCount: number;
}

/**
 * Revise two truth values using NARS revision rule
 * Combines evidence from multiple sources
 */
export function reviseTruths(t1: Truth, t2: Truth): RevisionResult {
    const revised = TruthOps.revision(t1, t2);

    // Estimate evidence count based on confidence
    // Higher confidence = more evidence
    const evidence1 = Math.round(t1.c * 10);
    const evidence2 = Math.round(t2.c * 10);

    return {
        revised,
        evidenceCount: evidence1 + evidence2
    };
}

/**
 * Check if two tasks are duplicates (same term)
 */
export function isDuplicate(task1: TaskData, task2: TaskData): boolean {
    return termsEqual(task1.term, task2.term);
}

/**
 * Deduplicate a list of tasks
 * Keeps the most recent or highest confidence task
 */
export function deduplicateTasks(tasks: TaskData[]): TaskData[] {
    const map = new TermMap<TaskData>();

    for (const task of tasks) {
        const existing = map.get(task.term);

        if (!existing) {
            map.set(task.term, task);
        } else {
            // Keep task with higher confidence or more recent
            const existingConf = existing.truth?.c ?? 0;
            const newConf = task.truth?.c ?? 0;

            if (newConf > existingConf) {
                map.set(task.term, task);
            }
        }
    }

    return Array.from(map.values());
}
