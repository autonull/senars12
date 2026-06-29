import type {RuleResult} from '../rules';
import {Stamp} from '../terms';
import type {Task} from '../types';
import {createBudget} from '../types';

const MAX_RECENT_STAMPS = 1000;

export const exceedsDepthLimit = (task: Task, maxDepth: number): boolean =>
    task.stamp.depth >= maxDepth;

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

export const createDerivedTask = (result: RuleResult): Task => ({
    term: result.term,
    type: 'belief',
    truth: result.truth,
    budget: createBudget(result.priority),
    stamp: result.stamp,
    occurrenceTime: Date.now() as Task['occurrenceTime'],
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
    if (!belief || !belief.truth) return null;
    return {
        term: concept.term,
        type: 'belief' as const,
        truth: belief.truth,
        budget: createBudget(concept.priority),
        stamp: belief.stamp ?? Stamp.createInput(),
        occurrenceTime: Date.now() as Task['occurrenceTime'],
        derived: false,
    };
};
