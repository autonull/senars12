import type {NAR} from '../nar/nar.js';
import type {EpisodeWorkingMemory} from './EpisodeWorkingMemory.js';
import {AgentEventBus} from './AgentEventBus.js';

export interface DrivesOptions {
    nar?: NAR;
    eventBus: AgentEventBus;
    wm?: EpisodeWorkingMemory;
}

export class Drives {
    private readonly nar?: NAR;
    private readonly eventBus: AgentEventBus;
    private readonly wm?: EpisodeWorkingMemory;
    private lastCuriosityCheck = 0;
    private lastCoherenceCheck = 0;
    private lastCompetenceCheck = 0;

    constructor(opts: DrivesOptions) {
        this.nar = opts.nar;
        this.eventBus = opts.eventBus;
        this.wm = opts.wm;
    }

    async tick(): Promise<void> {
        await this.checkCuriosity();
        await this.checkCoherence();
        await this.checkCompetence();
    }

    private async checkCuriosity(): Promise<void> {
        if (!this.nar) return;
        const now = Date.now();
        if (now - this.lastCuriosityCheck < 120_000) return;
        this.lastCuriosityCheck = now;

        const beliefs = this.nar.getBeliefs();
        const uncertain = beliefs
            .filter((b: {truth: {c: number}}) => b.truth.c < 0.5)
            .sort((a: {truth: {c: number}}, b: {truth: {c: number}}) => a.truth.c - b.truth.c)
            .slice(0, 3);

        for (const b of uncertain) {
            const termStr = b.term.toString();
            this.eventBus.emit('drive:curiosity', {concept: termStr, timestamp: Date.now()});
            try {
                await this.nar.question(termStr.replace(/[.?!]$/, '') + '?');
                await this.nar.run(3);
            } catch {
                // best-effort curiosity query
            }
        }
    }

    private async checkCoherence(): Promise<void> {
        if (!this.nar) return;
        const now = Date.now();
        if (now - this.lastCoherenceCheck < 180_000) return;
        this.lastCoherenceCheck = now;

        const beliefs = this.nar.getBeliefs();
        for (let i = 0; i < beliefs.length; i++) {
            for (let j = i + 1; j < beliefs.length; j++) {
                const a = beliefs[i]!;
                const b = beliefs[j]!;
                const aStr = a.term.toString();
                const bStr = b.term.toString();
                if (aStr === bStr) continue;
                if ((aStr.includes(bStr) || bStr.includes(aStr)) &&
                    ((a.truth.f > 0.7 && b.truth.f < 0.3) || (a.truth.f < 0.3 && b.truth.f > 0.7))) {
                    this.eventBus.emit('drive:coherence', {
                        contradiction: `${aStr} (f=${a.truth.f.toFixed(2)}) vs ${bStr} (f=${b.truth.f.toFixed(2)})`,
                        timestamp: Date.now(),
                    });
                    await this.nar.run(5);
                    return;
                }
            }
        }
    }

    private async checkCompetence(): Promise<void> {
        if (!this.nar) return;
        const now = Date.now();
        if (now - this.lastCompetenceCheck < 240_000) return;
        this.lastCompetenceCheck = now;

        const questions = this.nar.getQuestions();
        if (questions.length > 0) {
            this.eventBus.emit('drive:competence', {
                prediction: `${questions.length} unanswered questions remain`,
                timestamp: Date.now(),
            });
            await this.nar.run(5);
        }
    }
}
