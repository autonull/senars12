import type { Concept, Memory } from '../../memory';
import { containsSubterm } from '../../terms';
import type { SamplingStrategy } from '../types.js';

export class GoalBiasedSampling implements SamplingStrategy {
  readonly metadata = {
    name: 'goal-biased',
    description: 'Boost concepts related to active goals',
  };

  sample(memory: Memory, count: number): Concept[] {
    const goals = memory.getGoals();
    return memory
      .listConcepts()
      .map((c) => ({
        concept: c,
        score:
          c.priority *
          (goals.some((g) => containsSubterm(c.term, g.term) || containsSubterm(g.term, c.term))
            ? 1.5
            : 1.0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map((e) => e.concept);
  }
}
