import type {Concept} from './concept.js';
import {Memory} from './memory.js';

export interface StatisticsData {
    totalConcepts: number;
    totalTasks: number;
    avgPriority: number;
    maxPriority: number;
    minPriority: number;
    conceptsByType: Map<string, number>;
}

export class MemoryStatistics {
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

    getStatistics(memory: Memory): StatisticsData {
        const concepts = memory.sample(1000);
        const priorities = concepts.map(c => c.priority);
        const avgPriority = priorities.length > 0 ? priorities.reduce((sum, p) => sum + p, 0) / priorities.length : 0;
        const maxPriority = priorities.length > 0 ? Math.max(...priorities) : 0;
        const minPriority = priorities.length > 0 ? Math.min(...priorities) : 1;

        const conceptsByType = new Map<string, number>();
        for (const concept of concepts) {
            const key = concept.term.kind;
            conceptsByType.set(key, (conceptsByType.get(key) ?? 0) + 1);
        }

        return {
            totalConcepts: this.conceptCount,
            totalTasks: this.taskCount,
            avgPriority,
            maxPriority,
            minPriority,
            conceptsByType
        };
    }
}

export const memoryStatistics = new MemoryStatistics();
