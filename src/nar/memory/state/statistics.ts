import type {Concept} from '../concept.js';
import {THRESHOLDS} from '../../constants.js';

const {PRIORITY: PRIORITY_THRESHOLDS} = THRESHOLDS;

export interface ConceptStats {
    totalConcepts: number;
    totalTasks: number;
    lowPriority: number;
    mediumPriority: number;
    highPriority: number;
}

export const calculateConceptStats = (concepts: Iterable<Concept>): ConceptStats => {
    const stats: ConceptStats = {totalConcepts: 0, totalTasks: 0, lowPriority: 0, mediumPriority: 0, highPriority: 0};
    for (const concept of concepts) {
        stats.totalConcepts++;
        stats.totalTasks += concept.totalTasks;
        stats[concept.priority < PRIORITY_THRESHOLDS.LOW ? 'lowPriority' : concept.priority < PRIORITY_THRESHOLDS.MEDIUM ? 'mediumPriority' : 'highPriority']++;
    }
    return stats;
};
