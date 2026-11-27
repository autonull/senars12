import { BoundedMap } from '@senars/util/bounded-map';
import { termKey } from '../terms';
import { createTaskWeight, createTask } from '../types';
const MAX_RECENT_CONCLUSIONS = 1000;
export const exceedsDepthLimit = (task, maxDepth) => task.stamp.derivations.length >= maxDepth;
/** A task in the shape the rule engine consumes. */
export const toRuleInput = (task) => ({
    term: task.term,
    truth: task.truth,
    stamp: task.stamp,
    occurrenceTime: task.occurrenceTime,
});
/**
 * A conclusion repeats when the same evidence produced the same term and truth.
 * The stamp alone is not an identity: every task an LM rule derives from one
 * premise pair shares that pair's stamp, so keying on it discarded all but the
 * first candidate of a multi-candidate proposal.
 */
const conclusionKey = (task) => `${task.stamp.id}|${termKey(task.term)}|${task.truth.f}:${task.truth.c}`;
export const createCircularDetector = () => {
    const recent = new BoundedMap({
        maxSize: MAX_RECENT_CONCLUSIONS,
        eviction: 'fifo',
    });
    return {
        isCircular: (task) => {
            const key = conclusionKey(task);
            if (recent.has(key))
                return true;
            recent.set(key, true);
            return false;
        },
        reset: () => recent.clear(),
    };
};
export const createDerivedTask = (result, taskType = 'belief') => createTask(result.term, taskType, result.truth, createTaskWeight(result.priority), {
    stamp: result.stamp,
    derived: true,
});
