import { containsSubterm } from '../../terms';
import { rankedSample } from './scored';
import { Strategy } from '../base';
export class GoalBiasedSampling extends Strategy {
    constructor() {
        super('goal-biased', 'Boost concepts related to active goals');
    }
    sample(memory, count) {
        return rankedSample(memory.conceptValues(), count, this.goalBiasScore(memory.getGoals()));
    }
    goalBiasScore(goals) {
        return (c) => c.priority *
            (goals.some((g) => containsSubterm(c.term, g.term) || containsSubterm(g.term, c.term))
                ? 1.5
                : 1.0);
    }
}
