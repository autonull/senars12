import type { Concept, Memory } from '../../memory';
import { selectTopN } from '../../utils/collections.js';
import { containsSubterm } from '../../terms';
import type { SamplingStrategy } from '../types.js';

export class GoalBiasedSampling implements SamplingStrategy {
  readonly metadata = {
    name: 'goal-biased',
    description: 'Boost concepts related to active goals',
  };

  sample(memory: Memory, count: number): Concept[] {
    const goals = memory.getGoals();
    return selectTopN(
      memory.listConcepts(),
      count,
      (c) =>
        c.priority *
        (goals.some((g) => containsSubterm(c.term, g.term) || containsSubterm(g.term, c.term))
          ? 1.5
          : 1.0)
    );
  }
}
