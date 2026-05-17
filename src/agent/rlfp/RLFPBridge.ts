import type {RLFPLearner} from '../../nar/rlfp/RLFPLearner.js';
import type {ScenarioResult} from '../scenarios/types.js';
import type {Experiment, ExperimentResult} from '../scenarios/types.js';

export interface PolicyUpdate {
    parameter: string;
    oldValue: unknown;
    newValue: unknown;
    reason: string;
}

export class RLFPBridge {
    private readonly learner: RLFPLearner;

    constructor(learner: RLFPLearner) {
        this.learner = learner;
    }

    onScenarioResult(result: ScenarioResult): void {
        const chosen = JSON.stringify(result.trajectory);
        const rejected = '';
        this.learner.addPreference(chosen, rejected);
    }

    onExperimentResult(experiment: Experiment, _result: ExperimentResult): void {
        if (experiment.config.type === 'hypothesis-test') {
            this.learner.addPreference('hypothesis_test', 'neutral');
        }
    }

    compareRuns(before: ScenarioResult[], after: ScenarioResult[]): PolicyUpdate[] {
        const updates: PolicyUpdate[] = [];
        const beforeScore = before.reduce((sum, r) => sum + r.score, 0) / Math.max(1, before.length);
        const afterScore = after.reduce((sum, r) => sum + r.score, 0) / Math.max(1, after.length);

        if (afterScore > beforeScore) {
            updates.push({
                parameter: 'score',
                oldValue: beforeScore,
                newValue: afterScore,
                reason: `Improved from ${beforeScore.toFixed(2)} to ${afterScore.toFixed(2)}`,
            });
        }

        return updates;
    }

    getOptimizationSuggestions(): PolicyUpdate[] {
        return [];
    }

    applySuggestion(_update: PolicyUpdate): void {
    }
}