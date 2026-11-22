import { maxScore } from '@senars/util/collections';
import { TERM_SEPARATORS, wordOverlap } from '@senars/util/text';
import type { Concept } from '../../memory/concept';
import type { MemoryView } from '../../memory/view';
import type { AttentionContext } from '../types';
import { SimpleAttention } from './SimpleAttention';

export class GoalRelevanceAttention extends SimpleAttention {
  override readonly metadata = {
    name: 'goal-relevance',
    description: 'Boost proportional to goal term overlap',
  };

  override prime(concept: Concept, ctx: AttentionContext): number {
    const boost = super.prime(concept, ctx);
    const goalOverlap = this.goalOverlap(concept, ctx.memory);
    return boost * (1 + goalOverlap * 0.5);
  }

  private goalOverlap(concept: Concept, memory: MemoryView): number {
    // `prime` runs once per sampled concept per cycle, so anything recomputed per
    // goal inside this scan is recomputed `concepts x goals` times.
    const goals = memory
      .getFocus()
      .getActiveGoals()
      .map((goal) => goal.term.toString().toLowerCase());
    if (goals.length === 0) return 0;
    const termStr = concept.term.toString().toLowerCase();
    return maxScore(goals, (goal) => wordOverlap(termStr, goal, TERM_SEPARATORS));
  }
}
