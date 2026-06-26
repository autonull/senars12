import type {Concept, Memory} from '../../memory/index.js';
import type {SamplingStrategy} from '../types.js';

export class GoalBiasedSampling implements SamplingStrategy {
    readonly metadata = {name: 'goal-biased', description: 'Boost concepts related to active goals'};

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
