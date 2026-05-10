/**
 * Belief revision and deduplication utilities
 */

import type {TaskData} from './concept.js';
import type {Truth} from '../terms';
import {Truth as TruthOps} from '../terms/truth.js';
import {termsEqual} from '../terms/accessors.js';

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
 * Check if two tasks are duplicates (same term hash)
 */
export function isDuplicate(task1: TaskData, task2: TaskData): boolean {
    return termsEqual(task1.term, task2.term);
}

/**
 * Deduplicate a list of tasks
 * Keeps the most recent or highest confidence task
 */
export function deduplicateTasks(tasks: TaskData[]): TaskData[] {
    const map = new Map<number, TaskData>();

    for (const task of tasks) {
        const hash = task.term.hash;
        const existing = map.get(hash);

        if (!existing) {
            map.set(hash, task);
        } else {
            // Keep task with higher confidence or more recent
            const existingConf = existing.truth?.c ?? 0;
            const newConf = task.truth?.c ?? 0;

            if (newConf > existingConf) {
                map.set(hash, task);
            }
        }
    }

    return Array.from(map.values());
}

/**
 * Merge multiple belief tasks about the same term
 * Returns revised truth value
 */
export function mergeBeliefs(tasks: TaskData[]): Truth | undefined {
    if (tasks.length === 0) return undefined;

    const firstTruth = tasks[0]?.truth;
    if (!firstTruth) return undefined;

    let result = firstTruth;

    for (let i = 1; i < tasks.length; i++) {
        const current = tasks[i]?.truth;
        if (current) {
            result = TruthOps.revision(result, current);
        }
    }

    return result;
}
