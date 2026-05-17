import type {NAR} from '../../nar/nar.js';
import type {Experiment, ExperimentConfig, ExperimentResult} from '../scenarios/types.js';
import {ScenarioRunner} from '../scenarios/ScenarioRunner.js';

export class ExperimentRunner {
    private readonly nar: NAR;
    private readonly scenarioRunner: ScenarioRunner;
    private readonly experiments: Map<string, Experiment> = new Map();

    constructor(nar: NAR, scenarioRunner: ScenarioRunner) {
        this.nar = nar;
        this.scenarioRunner = scenarioRunner;
    }

    createExperiment(config: ExperimentConfig): Experiment {
        const experiment: Experiment = {
            id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: config.name,
            type: config.type,
            description: config.description,
            status: 'pending',
            config,
            createdAt: Date.now(),
        };
        this.experiments.set(experiment.id, experiment);
        return experiment;
    }

    async runExperiment(experimentId: string): Promise<ExperimentResult | null> {
        const experiment = this.experiments.get(experimentId);
        if (!experiment) return null;

        experiment.status = 'running';
        const startTime = Date.now();

        try {
            let details: Record<string, unknown> = {};

            switch (experiment.config.type) {
                case 'parameter-sweep':
                    details = await this.runParameterSweep(experiment.config);
                    break;
                case 'prompt-ab':
                    details = {variants: experiment.config.promptVariants};
                    break;
                case 'hypothesis-test':
                    details = await this.runHypothesisTest(experiment.config);
                    break;
                default:
                    details = {note: 'Experiment type not yet implemented'};
            }

            const result: ExperimentResult = {
                experimentId,
                score: 0.5,
                details,
                duration: Date.now() - startTime,
            };

            experiment.results = result;
            experiment.status = 'completed';
            experiment.completedAt = Date.now();

            return result;
        } catch (_error) {
            experiment.status = 'failed';
            return null;
        }
    }

    cancelExperiment(experimentId: string): void {
        const experiment = this.experiments.get(experimentId);
        if (experiment && experiment.status === 'running') {
            experiment.status = 'cancelled';
        }
    }

    getExperiment(experimentId: string): Experiment | undefined {
        return this.experiments.get(experimentId);
    }

    listExperiments(status?: string): Experiment[] {
        const all = Array.from(this.experiments.values());
        if (status) {
            return all.filter(e => e.status === status);
        }
        return all;
    }

    private async runParameterSweep(config: ExperimentConfig): Promise<Record<string, unknown>> {
        return {parameters: config.parameters, objective: config.objective};
    }

    private async runHypothesisTest(config: ExperimentConfig): Promise<Record<string, unknown>> {
        if (config.beliefs) {
            for (const belief of config.beliefs) {
                await this.nar.believe(belief);
            }
        }
        return {hypothesis: config.hypothesis, verdictThreshold: config.verdictThreshold};
    }
}