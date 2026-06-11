import type {NAR} from '../nar/nar.js';
import {AgentEventBus} from './AgentEventBus.js';
import type {Goal} from './GoalManager.js';

export interface MetaCriticOptions {
    nar?: NAR;
    eventBus: AgentEventBus;
}

export interface MetaEvaluation {
    score: number;
    recommendations: string[];
    goalId?: string;
    timestamp: number;
}

export class MetaCritic {
    private readonly nar?: NAR;
    private readonly eventBus: AgentEventBus;
    private lastScore?: number;

    constructor(opts: MetaCriticOptions) {
        this.nar = opts.nar;
        this.eventBus = opts.eventBus;
    }

    getLastScore(): number | undefined {
        return this.lastScore;
    }

    evaluate(goal: Goal | undefined, wmSnapshot: Record<string, unknown>): MetaEvaluation {
        const factors: number[] = [];
        const recommendations: string[] = [];

        if (goal && this.nar) {
            const keywords = goal.description.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            const allBeliefs = this.nar.getBeliefs();
            const relevantBeliefs = allBeliefs.filter((b: {term: {toString(): string}}) => {
                const termStr = b.term.toString().toLowerCase();
                return keywords.some(k => termStr.includes(k));
            });
            const support = relevantBeliefs.length > 0
                ? relevantBeliefs.reduce((sum: number, b: {truth: {c: number}}) => sum + b.truth.c, 0) / relevantBeliefs.length
                : 0;
            factors.push(support);
            if (relevantBeliefs.length === 0) {
                recommendations.push('No beliefs support the active goal — consider gathering information');
            }
        }

        if (goal) {
            const keywords = goal.description.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            const wmText = Object.values(wmSnapshot).flatMap(v =>
                Array.isArray(v) ? v : [String(v)]
            ).join(' ').toLowerCase();
            const hasRelevantWM = keywords.some(k => wmText.includes(k));
            factors.push(hasRelevantWM ? 0.8 : 0.2);
            if (!hasRelevantWM) {
                recommendations.push('Working memory lacks goal-relevant content');
            }
        }

        if (goal) {
            factors.push(goal.progress);
            if (goal.progress < 0.1) {
                recommendations.push('Goal progress is minimal — consider breaking into subgoals');
            }
        }

        const score = factors.length > 0
            ? factors.reduce((a, b) => a + b, 0) / factors.length
            : 0.5;

        this.lastScore = score;
        return {score, recommendations, goalId: goal?.id, timestamp: Date.now()};
    }

    async tick(goal: Goal | undefined, wmSnapshot: Record<string, unknown>): Promise<void> {
        const evaluation = this.evaluate(goal, wmSnapshot);
        this.eventBus.emit('agent:meta:evaluation', {
            score: evaluation.score,
            recommendations: evaluation.recommendations,
            goalId: evaluation.goalId,
            timestamp: evaluation.timestamp,
        });
    }
}
