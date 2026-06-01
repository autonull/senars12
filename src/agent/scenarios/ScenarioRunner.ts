import type {NAR} from '../../nar/nar.js';
import type {
    Scenario,
    ScenarioResult,
    ScenarioStep,
    TrajectoryStep,
    AssertionResult,
    ScenarioExpectation,
    VariantComparison,
} from './types.js';
import {createLogger} from '../../nar/logger/index.js';

export class ScenarioRunner {
    private readonly nar: NAR;
    private readonly logger = createLogger({scope: 'scenario:runner'});

    constructor(nar: NAR) {
        this.nar = nar;
    }

    async run(test: Scenario): Promise<ScenarioResult> {
        switch (test.type ?? 'single') {
            case 'single':
            case 'regression':
            case 'adversarial':
            case 'stress':
                return this.runSingle(test);
            case 'parameter-sweep':
                return this.runSweep(test);
            case 'prompt-ab':
            case 'hypothesis-test':
                return this.runVariant(test);
            default:
                return this.runSingle(test);
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

    private async runSingle(test: Scenario): Promise<ScenarioResult> {
        const startTime = Date.now();
        const trajectory: TrajectoryStep[] = [];
        const beliefsBefore = this.nar.getBeliefs().length;
        const startBeliefs = beliefsBefore;

        try {
            if (test.setup) {
                await test.setup(this.nar);
            }

            for (let i = 0; i < test.steps.length; i++) {
                const step = test.steps[i]!;
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
                trajectoryStep.output = response;

                if (step.runSteps && step.runSteps > 0) {
                    const derived = await this.nar.run(step.runSteps);
                    trajectoryStep.derivations = derived;
                }

                trajectory.push(trajectoryStep);
            }

            if (test.teardown) {
                await test.teardown(this.nar);
            }

            const beliefs = this.nar.getBeliefs();
            const beliefTerms = beliefs.map(b => b.term.toString());
            const beliefsAfter = beliefs.length;
            const derivedCount = Math.max(0, beliefsAfter - startBeliefs);
            const derivations = derivedCount;

            const details = this.evaluateExpectations(test.expectation, trajectory, beliefTerms, derivations);
            const score = details.length > 0
                ? details.reduce((sum, d) => sum + d.score, 0) / details.length
                : 1.0;

            return {
                scenario: test,
                testId: test.id,
                passed: details.every(d => d.passed),
                score,
                details,
                trajectory,
                beliefs: beliefTerms,
                beliefsBefore,
                beliefsAfter,
                derivations,
                derivedCount,
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                scenario: test,
                testId: test.id,
                passed: false,
                score: 0,
                details: [],
                trajectory,
                beliefs: this.nar.getBeliefs().map(b => b.term.toString()),
                derivations: 0,
                duration: Date.now() - startTime,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    private async runSweep(test: Scenario): Promise<ScenarioResult> {
        const startTime = Date.now();
        if (!test.parameters || Object.keys(test.parameters).length === 0) {
            return this.runSingle(test);
        }

        const combinations = this.generateCombinations(test.parameters);
        const results: Array<{params: Record<string, any>; result: ScenarioResult}> = [];

        for (const params of combinations) {
            const modified: Scenario = {
                ...test,
                steps: test.steps.map(step => ({
                    ...step,
                    runSteps: (params.depth as number) || step.runSteps,
                })),
            };
            results.push({params, result: await this.runSingle(modified)});
        }

        const bestScore = Math.max(...results.map(r => r.result.score));
        const comparison: VariantComparison = {
            baseline: 'default',
            variants: results.map(r => ({
                name: Object.entries(r.params).map(([k, v]) => `${k}=${v}`).join('_'),
                score: r.result.score,
                delta: r.result.score - bestScore,
                significant: Math.abs(r.result.score - bestScore) > 0.1,
            })),
        };

        return {
            scenario: test,
            testId: test.id,
            passed: results.some(r => r.result.passed),
            score: bestScore,
            details: [],
            trajectory: [],
            beliefs: [],
            derivations: 0,
            duration: Date.now() - startTime,
            comparison,
        };
    }

    private async runVariant(test: Scenario): Promise<ScenarioResult> {
        const startTime = Date.now();
        if (!test.variants || test.variants.length === 0) {
            return this.runSingle(test);
        }

        const baseline = await this.runSingle(test);
        const variantResults: ScenarioResult[] = [];

        for (const variant of test.variants) {
            const modified: Scenario = {...test};

            if (variant.parameterOverrides) {
                modified.parameters = {...test.parameters, ...variant.parameterOverrides};
            }

            if (variant.inputOverrides) {
                modified.steps = test.steps.map((step, idx) => {
                    const override = variant.inputOverrides![idx];
                    return override ? {...step, ...override} : step;
                });
            }

            variantResults.push(await this.runSingle(modified));
        }

        const comparison: VariantComparison = {
            baseline: test.variants[0]?.name || 'baseline',
            variants: variantResults.map((result, idx) => ({
                name: test.variants![idx + 1]?.name || `variant-${idx}`,
                score: result.score,
                delta: result.score - baseline.score,
                significant: Math.abs(result.score - baseline.score) > 0.1,
            })),
        };

        return {
            scenario: test,
            testId: test.id,
            passed: baseline.passed,
            score: baseline.score,
            details: baseline.details,
            trajectory: baseline.trajectory,
            beliefs: baseline.beliefs,
            derivations: baseline.derivations,
            duration: Date.now() - startTime,
            comparison,
        };
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
        trajectory: TrajectoryStep[],
        beliefs: string[],
        derivations: number,
    ): AssertionResult[] {
        if (!expectation) {
            return [{description: 'No expectations', passed: true, score: 1.0}];
        }
        const results: AssertionResult[] = [];

        if (expectation.contains) {
            for (const term of expectation.contains) {
                const passed = beliefs.some(b => b.includes(term));
                results.push({
                    description: `Contains: ${term}`,
                    passed,
                    score: passed ? 1.0 : 0.0,
                });
            }
        }

        if (expectation.notContains) {
            for (const term of expectation.notContains) {
                const passed = beliefs.every(b => !b.includes(term));
                results.push({
                    description: `Not contains: ${term}`,
                    passed,
                    score: passed ? 1.0 : 0.0,
                });
            }
        }

        if (expectation.responseContains) {
            const lastResponse = trajectory[trajectory.length - 1]?.response || '';
            const passed = lastResponse.includes(expectation.responseContains);
            results.push({
                description: `Response contains "${expectation.responseContains}"`,
                passed,
                score: passed ? 1 : 0,
            });
        }

        if (expectation.responseNotContains) {
            const lastResponse = trajectory[trajectory.length - 1]?.response || '';
            for (const text of expectation.responseNotContains) {
                const passed = !lastResponse.includes(text);
                results.push({
                    description: `Response not contains "${text}"`,
                    passed,
                    score: passed ? 1 : 0,
                });
            }
        }

        if (expectation.minDerivations !== undefined) {
            const passed = derivations >= expectation.minDerivations;
            results.push({
                description: `Min derivations: ${expectation.minDerivations}`,
                passed,
                score: passed ? 1.0 : Math.min(1.0, derivations / expectation.minDerivations),
                detail: `Got ${derivations}`,
            });
        }

        if (expectation.maxDerivations !== undefined) {
            const passed = derivations <= expectation.maxDerivations;
            results.push({
                description: `Max derivations: ${expectation.maxDerivations}`,
                passed,
                score: passed ? 1.0 : Math.min(1.0, expectation.maxDerivations / Math.max(1, derivations)),
                detail: `Got ${derivations}`,
            });
        }

        if (expectation.memorySize) {
            const [min, max] = expectation.memorySize;
            const passed = beliefs.length >= min && beliefs.length <= max;
            results.push({
                description: `Memory size ${beliefs.length} in [${min}, ${max}]`,
                passed,
                score: passed ? 1 : 0,
            });
        }

        return results.length > 0 ? results : [{description: 'Default', passed: true, score: 1.0}];
    }

    private generateCombinations(
        params: Record<string, {min?: number; max?: number; step?: number; values?: any[]}>,
    ): Record<string, any>[] {
        const keys = Object.keys(params);
        if (keys.length === 0) return [{}];

        const [firstKey, ...restKeys] = keys;
        const firstParam = params[firstKey!];
        const firstValues = firstParam?.values ?? this.range(firstParam?.min ?? 0, firstParam?.max ?? 0, firstParam?.step ?? 1);
        const restParams: Record<string, any> = {};
        restKeys.forEach(k => { restParams[k] = params[k]; });
        const restCombinations = this.generateCombinations(restParams);

        return firstValues.flatMap((firstVal: any) =>
            restCombinations.map((rest: any) => ({
                [firstKey!]: firstVal,
                ...rest,
            })),
        );
    }

    private range(min: number, max: number, step: number): number[] {
        const result: number[] = [];
        for (let i = min; i <= max; i += step) result.push(i);
        return result;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export function defineScenario(spec: Omit<Scenario, 'id' | 'category'> & {id: string; category?: Scenario['category']}): Scenario {
    return {
        id: spec.id,
        name: spec.name,
        description: spec.description,
        steps: spec.steps,
        expectation: spec.expectation,
        type: spec.type ?? 'single',
        parameters: spec.parameters,
        variants: spec.variants,
        category: spec.category ?? 'test',
        tags: spec.tags,
        weight: spec.weight,
    };
}

export const Scenarios = {
    transitive: (depth = 3) => defineScenario({
        id: 'transitive-inference',
        name: 'Transitive Inference',
        description: 'Test A→B, B→C ⊢ A→C',
        steps: [
            {input: '<A --> B>.', type: 'belief', runSteps: depth},
            {input: '<B --> C>.', type: 'belief', runSteps: depth},
        ],
        expectation: {
            contains: ['(A --> C)'],
            minDerivations: 1,
        },
        category: 'test',
    }),

    operationMisuse: () => defineScenario({
        id: 'operation-misuse-check',
        name: 'Operation Misuse Detection',
        description: 'Verify no ^ operators in declarative reasoning',
        steps: [
            {input: '<cat --> animal>.', type: 'belief'},
        ],
        expectation: {
            notContains: ['^'],
            maxDerivations: 5,
        },
        category: 'test',
    }),

    premiseRelevance: () => defineScenario({
        id: 'premise-relevance',
        name: 'Premise Relevance Test',
        description: 'Test that related concepts are prioritized',
        steps: [
            {input: '<cat --> animal>.', type: 'belief'},
            {input: '<dog --> animal>.', type: 'belief'},
        ],
        expectation: {
            contains: ['cat', 'animal'],
            minDerivations: 1,
        },
        category: 'benchmark',
    }),
};
