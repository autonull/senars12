import type { Concept } from '../../memory/concept';
import type { MemoryView } from '../../memory/view';
import { containsSubterm, type Term } from '../../terms';
import type { SamplingStrategy } from '../types';
import { rankedSample } from './scored';
import { Strategy } from '../base';

export class GoalBiasedSampling extends Strategy implements SamplingStrategy {
  constructor() {
    super('goal-biased', 'Boost concepts related to active goals');
  }

  sample(memory: MemoryView, count: number): Concept[] {
    return rankedSample(memory.conceptValues(), count, this.goalBiasScore(memory.getGoals()));
  }

  private goalBiasScore(goals: readonly { term: Term }[]): (c: Concept) => number {
    return (c: Concept) =>
      c.priority *
      (goals.some((g) => containsSubterm(c.term, g.term) || containsSubterm(g.term, c.term))
        ? 1.5
        : 1.0);
  }
}