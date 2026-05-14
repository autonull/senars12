import type {Concept} from '../memory';
import type {Term} from '../terms';
import {isCompound} from '../terms';

export interface TermPattern {
    term: string;
    frequency: number;
    coOccurrences: Map<string, number>;
    avgPriority: number;
    lastSeen: number;
}

export class PatternAnalyzer {
    private readonly MAX_PATTERNS = 20;

    analyzeTermPatterns(concepts: Concept[]): TermPattern[] {
        const termFreq = new Map<string, { count: number; priorities: number[]; coOccurrences: Map<string, number> }>();

        for (const concept of concepts) {
            const termStr = concept.term.toString();
            if (!termFreq.has(termStr)) {
                termFreq.set(termStr, {count: 0, priorities: [], coOccurrences: new Map()});
            }
            const data = termFreq.get(termStr)!;
            data.count++;
            data.priorities.push(concept.priority);

            for (const neighbor of this.getNeighboringTerms(concept)) {
                const coKey = neighbor.toString();
                if (coKey !== termStr) {
                    data.coOccurrences.set(coKey, (data.coOccurrences.get(coKey) || 0) + 1);
                }
            }
        }

        const patterns: TermPattern[] = [];
        for (const [term, data] of termFreq.entries()) {
            patterns.push({
                term,
                frequency: data.count,
                coOccurrences: data.coOccurrences,
                avgPriority: data.priorities.reduce((a, b) => a + b, 0) / (data.priorities.length || 1),
                lastSeen: Date.now()
            });
        }

        return patterns.sort((a, b) => b.frequency - a.frequency).slice(0, this.MAX_PATTERNS);
    }

    private getNeighboringTerms(concept: Concept): Term[] {
        const neighbors: Term[] = [];
        const term = concept.term as Term;

        if (isCompound(term)) {
            const subject = term.args?.[0];
            const predicate = term.args?.[1];
            if (subject) neighbors.push(subject);
            if (predicate) neighbors.push(predicate);
        }

        return neighbors;
    }

    calculateAvgPriority(priorities: number[]): number {
        return priorities.reduce((a, b) => a + b, 0) / (priorities.length || 1);
    }
}