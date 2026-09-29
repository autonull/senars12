import type { Concept } from '../../memory/concept.js';
import type { MemoryView } from '../../memory/view.js';
import { maxScore, wordOverlap } from '../../utils';
import type { AttentionContext } from '../types.js';
import { SimpleAttention } from './SimpleAttention.js';

export class GoalRelevanceAttention extends SimpleAttention {
  override readonly metadata = {
    name: 'goal-relevance',
    description: 'Boost proportional to goal term overlap',
  };

  private readonly SPLIT_PATTERN = /[\s_()<>]+/;

  override prime(concept: Concept, ctx: AttentionContext): number {
    const boost = super.prime(concept, ctx);
    const goalOverlap = this.goalOverlap(concept, ctx.memory);
    return boost * (1 + goalOverlap * 0.5);
  }

  private goalOverlap(concept: Concept, memory: MemoryView): number {
    const termStr = concept.term.toString().toLowerCase();
    const goals = memory.getFocus().getActiveGoals();
    if (goals.length === 0) return 0;
    return maxScore(goals, (goal) =>
      wordOverlap(termStr, goal.term.toString().toLowerCase(), this.SPLIT_PATTERN)
    );
  }
}
