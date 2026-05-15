import type {Concept} from './concept.js';

export interface StatisticsData {
    totalConcepts: number;
    totalTasks: number;
    avgPriority: number;
    maxPriority: number;
    minPriority: number;
    conceptsByType: Map<string, number>;
}

export interface ConceptStats {
    totalConcepts: number;
    totalTasks: number;
    lowPriority: number;
    mediumPriority: number;
    highPriority: number;
}

export class StatisticsCalculator {
    private conceptCount: number;
    private taskCount: number;
    private prioritySum: number;
    private maxPriority: number;
    private minPriority: number;
    private typeCounts: Map<string, number>;

    constructor() {
        this.conceptCount = 0;
        this.taskCount = 0;
        this.prioritySum = 0;
        this.maxPriority = 0;
        this.minPriority = 1;
        this.typeCounts = new Map();
    }

    get stats(): {
        conceptCount: number;
        taskCount: number;
        avgPriority: number;
        maxPriority: number;
        minPriority: number;
    } {
        const avg = this.conceptCount > 0 ? this.prioritySum / this.conceptCount : 0;
        return {
            conceptCount: this.conceptCount,
            taskCount: this.taskCount,
            avgPriority: avg,
            maxPriority: this.maxPriority,
            minPriority: this.minPriority
        };
    }

    recordConcept(concept: Concept): void {
        this.conceptCount++;
        const priority = concept.priority;
        this.prioritySum += priority;
        if (priority > this.maxPriority) this.maxPriority = priority;
        if (priority < this.minPriority) this.minPriority = priority;

        const typeKey = concept.term.kind;
        this.typeCounts.set(typeKey, (this.typeCounts.get(typeKey) ?? 0) + 1);
    }

    recordTask(): void {
        this.taskCount++;
    }

    reset(): void {
        this.conceptCount = 0;
        this.taskCount = 0;
        this.prioritySum = 0;
        this.maxPriority = 0;
        this.minPriority = 1;
        this.typeCounts.clear();
    }

    calculateFromConcepts(concepts: Iterable<Concept>): StatisticsData {
        const conceptList = [...concepts];
        const priorities = conceptList.map(c => c.priority);
        const avgPriority = priorities.length > 0 ? priorities.reduce((sum, p) => sum + p, 0) / priorities.length : 0;
        const maxPriority = priorities.length > 0 ? Math.max(...priorities) : 0;
        const minPriority = priorities.length > 0 ? Math.min(...priorities) : 1;

        const conceptsByType = new Map<string, number>();
        for (const concept of conceptList) {
            const key = concept.term.kind;
            conceptsByType.set(key, (conceptsByType.get(key) ?? 0) + 1);
        }

        return {
            totalConcepts: conceptList.length,
            totalTasks: conceptList.reduce((sum, c) => sum + c.totalTasks, 0),
            avgPriority,
            maxPriority,
            minPriority,
            conceptsByType
        };
    }

    calculateConceptStats(concepts: Iterable<Concept>): ConceptStats {
        const stats: ConceptStats = {
            totalConcepts: 0,
            totalTasks: 0,
            lowPriority: 0,
            mediumPriority: 0,
            highPriority: 0,
        };

        for (const concept of concepts) {
            stats.totalConcepts++;
            stats.totalTasks += concept.totalTasks;
            stats[concept.priority < 0.3 ? 'lowPriority' : concept.priority < 0.7 ? 'mediumPriority' : 'highPriority']++;
        }

        return stats;
    }
}