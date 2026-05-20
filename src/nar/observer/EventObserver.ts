import type {NAR} from '../nar.js';
import type {Task} from '../types/index.js';
import {Truth, Stamp} from '../terms/index.js';
import {createTask} from '../types/index.js';

export interface TemporalEvent {
    event: string;
    ts: number;
    task?: Task;
}

export interface TemporalRelation {
    antecedent: string;
    consequent: string;
    confidence: number;
    occurrences: number;
    avgDelay: number;
}

export class EventObserver {
    private log: TemporalEvent[] = [];
    private readonly windowMs = 3600000; // 1 hour

    observe(event: string, task?: Task): void {
        this.log.push({event, ts: Date.now(), task});
        this.log = this.log.filter(e => e.ts > Date.now() - this.windowMs);
    }

    detectPatterns(): TemporalRelation[] {
        if (this.log.length < 2) return [];

        const patterns: TemporalRelation[] = [];
        const uniqueEvents = [...new Set(this.log.map(e => e.event))];

        for (const a of uniqueEvents) {
            for (const b of uniqueEvents) {
                if (a === b) continue;

                const aEvents = this.log.filter(e => e.event === a).sort((x, y) => x.ts - y.ts);
                const bEvents = this.log.filter(e => e.event === b).sort((x, y) => x.ts - y.ts);

                let precedesCount = 0;
                let totalDelay = 0;

                for (const aEvent of aEvents) {
                    const nextB = bEvents.find(bEvent => bEvent.ts > aEvent.ts && bEvent.ts - aEvent.ts < 60000);
                    if (nextB) {
                        precedesCount++;
                        totalDelay += nextB.ts - aEvent.ts;
                    }
                }

                if (precedesCount >= 2) {
                    patterns.push({
                        antecedent: a,
                        consequent: b,
                        confidence: Math.min(0.9, precedesCount / Math.max(1, aEvents.length) * 0.8 + 0.1),
                        occurrences: precedesCount,
                        avgDelay: totalDelay / precedesCount,
                    });
                }
            }
        }

        return patterns.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
    }

    generateNarseseBeliefs(patterns: TemporalRelation[]): string[] {
        return patterns
            .filter(p => p.confidence > 0.5)
            .map(p => `((<${p.antecedent}> =/> <${p.consequent}>). :${p.confidence.toFixed(1)}:${(p.confidence * 0.9).toFixed(1)})`);
    }

    async applyToNAR(patterns: TemporalRelation[], nar: NAR): Promise<number> {
        const beliefs = this.generateNarseseBeliefs(patterns);
        let count = 0;
        for (const belief of beliefs) {
            try {
                await nar.believe(belief);
                count++;
            } catch { /* skip invalid */ }
        }
        return count;
    }

    getLog(): TemporalEvent[] {
        return [...this.log];
    }

    clear(): void {
        this.log = [];
    }

    getStats(): { events: number; uniqueEvents: number; windowMs: number } {
        return {
            events: this.log.length,
            uniqueEvents: new Set(this.log.map(e => e.event)).size,
            windowMs: this.windowMs,
        };
    }
}
