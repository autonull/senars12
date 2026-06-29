import type {Concept} from '../concept.js';

export interface ConceptStats {
    totalConcepts: number;
    totalTasks: number;
    lowPriority: number;
    mediumPriority: number;
    highPriority: number;
}

export const calculateConceptStats = (concepts: Iterable<Concept>): ConceptStats => {
    const priorities: number[] = [];
    let totalTasks = 0;
    for (const concept of concepts) {
        totalTasks += concept.totalTasks;
        priorities.push(concept.priority);
    }
    priorities.sort((a, b) => a - b);
    const n = priorities.length;
    const p33 = n > 0 ? priorities[Math.floor(n * 0.33)]! : 0;
    const p67 = n > 0 ? priorities[Math.floor(n * 0.67)]! : 0;

    return {
        totalConcepts: n,
        totalTasks,
        lowPriority: priorities.filter(p => p < p33).length,
        mediumPriority: priorities.filter(p => p >= p33 && p < p67).length,
        highPriority: priorities.filter(p => p >= p67).length
    };
};
