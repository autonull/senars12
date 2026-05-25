import type {Memory, Concept} from '../memory';
import type {SamplingStrategy} from './types';

export class PrioritySampling implements SamplingStrategy {
  readonly metadata = { name: 'priority', description: 'Priority-weighted sampling (current default)' };
  sample(memory: Memory, count: number): Concept[] {
    return memory.sample(count);
  }
}

export class TopNSampling implements SamplingStrategy {
  readonly metadata = { name: 'top-n', description: 'Take the N highest-priority concepts' };
  sample(memory: Memory, count: number): Concept[] {
    return memory.listConcepts()
      .sort((a, b) => b.priority - a.priority)
      .slice(0, count);
  }
}

export class NoveltySampling implements SamplingStrategy {
  readonly metadata = { name: 'novelty', description: 'Bias toward least-recently-accessed concepts' };
  sample(memory: Memory, count: number): Concept[] {
    return memory.listConcepts()
      .sort((a, b) => (a.lastAccessedAt ?? 0) - (b.lastAccessedAt ?? 0))
      .slice(0, count);
  }
}

export class GoalBiasedSampling implements SamplingStrategy {
  readonly metadata = { name: 'goal-biased', description: 'Boost concepts related to active goals' };
  sample(memory: Memory, count: number): Concept[] {
    const goals = memory.getGoals();
    const goalsStr = goals.map(g => g.term.toString().toLowerCase());
    return memory.listConcepts()
      .map(c => ({
        concept: c,
        score: c.priority * (goalsStr.some((g: string) => c.term.toString().toLowerCase().includes(g)) ? 1.5 : 1.0)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(e => e.concept);
  }
}

export class DiverseSampling implements SamplingStrategy {
  readonly metadata = { name: 'diverse', description: 'Stratified sample across priority bands' };
  sample(memory: Memory, count: number): Concept[] {
    const concepts = memory.listConcepts();
    const bands = 4;
    const perBand = Math.max(1, Math.ceil(count / bands));
    const sorted = concepts.sort((a, b) => a.priority - b.priority);
    const bandSize = Math.max(1, Math.floor(sorted.length / bands));
    const result: Concept[] = [];
    for (let b = 0; b < bands; b++) {
      const start = b * bandSize;
      const band = sorted.slice(start, start + bandSize);
      result.push(...band.slice(0, perBand));
    }
    return result.slice(0, count);
  }
}
