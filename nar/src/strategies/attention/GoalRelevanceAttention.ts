import type {Concept, Memory} from '../../memory';
import type {AttentionContext} from '../types.js';
import {SimpleAttention} from './SimpleAttention.js';
import {wordOverlap} from '../../utils';

export class GoalRelevanceAttention extends SimpleAttention {
    override readonly metadata = {name: 'goal-relevance', description: 'Boost proportional to goal term overlap'};

    private readonly SPLIT_PATTERN = /[\s_()<>]+/;

    override prime(concept: Concept, ctx: AttentionContext): number {
        const boost = super.prime(concept, ctx);
        const goalOverlap = this.goalOverlap(concept, ctx.memory);
        return boost * (1 + goalOverlap * 0.5);
    }

    private goalOverlap(concept: Concept, memory: Memory): number {
        const termStr = concept.term.toString().toLowerCase();
        const goals = memory.getFocus().getActiveGoals();
        if (goals.length === 0) return 0;
        let maxOverlap = 0;
        for (const goal of goals) {
            const goalStr = goal.term.toString().toLowerCase();
            const overlap = wordOverlap(termStr, goalStr, this.SPLIT_PATTERN) || 0;
            if (overlap > maxOverlap) maxOverlap = overlap;
        }
        return maxOverlap;
    }
}