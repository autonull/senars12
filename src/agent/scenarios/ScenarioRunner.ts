import type {NAR} from '../../nar/nar.js';
import type {
    Scenario,
    ScenarioResult,
    ScenarioStep,
    TrajectoryStep,
    AssertionResult,
    ScenarioExpectation
} from './types.js';
import {createLogger} from '../../nar/logger/index.js';

export class ScenarioRunner {
    private readonly nar: NAR;
    private readonly logger = createLogger({scope: 'scenario:runner'});

    constructor(nar: NAR) {
        this.nar = nar;
    }

    async run(scenario: Scenario): Promise<ScenarioResult> {
        const startTime = Date.now();
        const trajectory: TrajectoryStep[] = [];
        const beliefsBefore = this.nar.getBeliefs().length;

        try {
            if (scenario.setup) {
                await scenario.setup(this.nar);
            }

            for (let i = 0; i < scenario.steps.length; i++) {
                const step = scenario.steps[i]!;
                const trajectoryStep: TrajectoryStep = {
                    step: i,
                    input: step.input,
                    timestamp: Date.now(),
                };

                if (step.waitMs) {
                    await this.sleep(step.waitMs);
                }

                const response = await this.executeStep(step);
                trajectoryStep.response = response;

                if (step.runSteps && step.runSteps > 0) {
                    const derived = await this.nar.run(step.runSteps);
                    trajectoryStep.derivations = derived;
                }

                trajectory.push(trajectoryStep);
            }

            const beliefsAfter = this.nar.getBeliefs().length;
            const derivedCount = Math.max(0, beliefsAfter - beliefsBefore);

            if (scenario.teardown) {
                await scenario.teardown(this.nar);
            }

            const details = this.evaluateExpectations(scenario.expectation, trajectory);

            return {
                scenario,
                passed: details.every(d => d.passed),
                score: details.reduce((sum, d) => sum + d.score, 0) / Math.max(1, details.length),
                details,
                trajectory,
                beliefsBefore,
                beliefsAfter,
                derivedCount,
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                scenario,
                passed: false,
                score: 0,
                details: [],
                trajectory,
                beliefsBefore,
                beliefsAfter: this.nar.getBeliefs().length,
                derivedCount: 0,
                duration: Date.now() - startTime,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    async runBatch(scenarios: Scenario[]): Promise<ScenarioResult[]> {
        const results: ScenarioResult[] = [];
        for (const scenario of scenarios) {
            const result = await this.run(scenario);
            results.push(result);
        }
        return results;
    }

    private async executeStep(step: ScenarioStep): Promise<string> {
        switch (step.type) {
            case 'belief':
                await this.nar.believe(step.input);
                return `Belief added: ${step.input}`;
            case 'question':
                await this.nar.question(step.input);
                return `Question asked: ${step.input}`;
            case 'goal':
                await this.nar.believe(step.input);
                return `Goal set: ${step.input}`;
            case 'chat':
                return `Chat: ${step.input}`;
            case 'command':
                return `Command: ${step.input}`;
            default:
                await this.nar.believe(step.input);
                return `Processed: ${step.input}`;
        }
    }

    private evaluateExpectations(
        expectation: ScenarioExpectation | undefined,
        trajectory: TrajectoryStep[]
    ): AssertionResult[] {
        if (!expectation) return [];

        const results: AssertionResult[] = [];

        if (expectation.responseContains) {
            const lastResponse = trajectory[trajectory.length - 1]?.response || '';
            const passed = lastResponse.includes(expectation.responseContains);
            results.push({
                description: `Response contains "${expectation.responseContains}"`,
                passed,
                score: passed ? 1 : 0,
            });
        }

        if (expectation.memorySize) {
            const beliefs = this.nar.getBeliefs().length;
            const [min, max] = expectation.memorySize;
            const passed = beliefs >= min && beliefs <= max;
            results.push({
                description: `Memory size ${beliefs} in [${min}, ${max}]`,
                passed,
                score: passed ? 1 : 0,
            });
        }

        return results;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}