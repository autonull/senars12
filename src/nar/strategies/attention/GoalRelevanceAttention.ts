import type {Concept, Memory} from '../../memory/index.js';
import type {AttentionContext} from '../types.js';
import {SimpleAttention} from './SimpleAttention.js';

export class GoalRelevanceAttention extends SimpleAttention {
  override readonly metadata = { name: 'goal-relevance', description: 'Boost proportional to goal term overlap' };

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
      const overlap = this.stringSimilarity(termStr, goalStr);
      if (overlap > maxOverlap) maxOverlap = overlap;
    }
    return maxOverlap;
  }

  private stringSimilarity(a: string, b: string): number {
    const aWords = new Set(a.split(/[\s_()<>]+/).filter(Boolean));
    const bWords = new Set(b.split(/[\s_()<>]+/).filter(Boolean));
    if (aWords.size === 0 || bWords.size === 0) return 0;
    let overlap = 0;
    for (const w of aWords) { if (bWords.has(w)) overlap++; }
    return overlap / Math.max(aWords.size, bWords.size);
  }
}
