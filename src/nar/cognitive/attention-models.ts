import type {Concept, Memory} from '../memory';
import type {AttentionModel, AttentionContext} from './types';

export class SimpleAttention implements AttentionModel {
  readonly metadata = { name: 'simple', description: 'Fixed boost on prime, exponential decay' };

  prime(_concept: Concept, _ctx: AttentionContext): number {
    return 0.3;
  }

  decay(concept: Concept, _cycles: number, baseDecayRate: number): number {
    return concept.priority * baseDecayRate;
  }

  tick(_memory: Memory, _cycleCount: number): void {}
}

export class SpreadingActivation extends SimpleAttention {
  override readonly metadata = { name: 'spreading', description: 'Prime propagates through term links' };

  override prime(concept: Concept, ctx: AttentionContext): number {
    const boost = super.prime(concept, ctx);
    const links = concept.getLinks();
    for (const link of links) {
      const target = ctx.memory.getConcept(link.concept.term);
      if (target && target !== concept) {
        target.priority = Math.min(1, target.priority + boost * (link.strength ?? 0.3));
      }
    }
    return boost;
  }

  override tick(memory: Memory, _cycleCount: number): void {}
}

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

export class CompositeAttention implements AttentionModel {
  readonly metadata = { name: 'composite', description: 'Weighted combination of attention models' };

  constructor(
    private readonly models: Array<{ model: AttentionModel; weight: number }>
  ) {}

  prime(concept: Concept, ctx: AttentionContext): number {
    return this.models.reduce((sum, m) => sum + m.model.prime(concept, ctx) * m.weight, 0);
  }

  decay(concept: Concept, cycles: number, rate: number): number {
    return this.models.reduce((sum, m) => sum + m.model.decay(concept, cycles, rate) * m.weight, 0);
  }

  tick(memory: Memory, cycleCount: number): void {
    for (const m of this.models) m.model.tick(memory, cycleCount);
  }
}
