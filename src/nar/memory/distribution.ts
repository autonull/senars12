import type {Concept} from './concept.js';
import {THRESHOLDS} from '../constants.js';

export interface Distribution {
    totalTasks: number;
    lowPriority: number;
    mediumPriority: number;
    highPriority: number;
}

export const calculateDistribution = (concepts: Iterable<Concept>): Distribution => {
    let total = 0, low = 0, med = 0, high = 0;
    for (const c of concepts) {
        total += c.totalTasks;
        if (c.priority < THRESHOLDS.PRIORITY.LOW) low++;
        else if (c.priority < THRESHOLDS.PRIORITY.MEDIUM) med++;
        else high++;
    }
    return {totalTasks: total, lowPriority: low, mediumPriority: med, highPriority: high};
};