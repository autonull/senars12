import {average} from './helpers.js';

export const calculatePriorityDistribution = (concepts: {priority: number; totalTasks?: number}[]): {
    totalTasks: number;
    lowPriority: number;
    mediumPriority: number;
    highPriority: number;
    avgPriority: number;
} => {
    let total = 0, low = 0, med = 0, high = 0;
    const priorities: number[] = [];

    for (const c of concepts) {
        total += c.totalTasks ?? 0;
        priorities.push(c.priority);

        if (c.priority < 0.3) low++;
        else if (c.priority < 0.7) med++;
        else high++;
    }

    return {
        totalTasks: total,
        lowPriority: low,
        mediumPriority: med,
        highPriority: high,
        avgPriority: average(priorities)
    };
};