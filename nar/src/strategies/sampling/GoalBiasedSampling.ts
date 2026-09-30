import type { Concept } from '../../memory/concept.js';
import type { MemoryView } from '../../memory/view.js';
import { selectTopN } from '@senars/util';
import { containsSubterm } from '../../terms';
import type { SamplingStrategy } from '../types.js';

export class GoalBiasedSampling implements SamplingStrategy {
  readonly metadata = {
    name: 'goal-biased',
    description: 'Boost concepts related to active goals',
  };

  sample(memory: MemoryView, count: number): Concept[] {
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
