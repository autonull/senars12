import type { Concept } from '../../memory/concept.js';
import type { MemoryView } from '../../memory/view.js';
import { containsSubterm, type Term } from '../../terms';
import type { SamplingStrategy } from '../types.js';
import { rankedSample } from './scored.js';

export const goalBiasScore =
  (goals: readonly { term: Term }[]) =>
  (c: Concept): number =>
    c.priority * (goals.some((g) => containsSubterm(c.term, g.term) || containsSubterm(g.term, c.term)) ? 1.5 : 1.0);

export class GoalBiasedSampling implements SamplingStrategy {
  readonly metadata = {
    name: 'goal-biased',
    description: 'Boost concepts related to active goals',
  };

  sample(memory: MemoryView, count: number): Concept[] {
    return rankedSample(memory.listConcepts(), count, goalBiasScore(memory.getGoals()));
  }
}
