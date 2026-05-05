import type { Term } from '../terms/types.js';
import type { Truth } from '../terms/truth.js';
import type { Stamp } from '../terms/stamp.js';

export type TaskType = 'belief' | 'goal' | 'question';

export interface Task {
    readonly term: Term;
    readonly type: TaskType;
    readonly truth: Truth;
    readonly budget: number;
    readonly stamp: Stamp;
    occurrenceTime: number;
    derived: boolean;
}

export function createTask(
    term: Term,
    type: TaskType,
    truth: Truth,
    budget = 0.9,
    derivations: readonly string[] = []
): Task {
    const now = Date.now();
    return {
        term,
        type,
        truth,
        budget,
        stamp: Object.freeze({
            id: `${now}-${Math.random().toString(36).slice(2, 9)}`,
            creationTime: now,
            source: 'INPUT' as const,
            derivations,
            depth: 0
        }),
        occurrenceTime: now,
        derived: false
    };
}