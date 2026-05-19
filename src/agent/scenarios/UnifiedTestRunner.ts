/**
 * Unified Scenario-Experiment Framework
 * Complete unification - no backwards compatibility
 */

import type {NAR} from '../../nar/index.js';
import {termParser} from '../../nar/terms/index.js';
import {TaskFormatter} from '../../nar/utils/task-formatter.js';

export type TestType = 
  | 'single'
  | 'parameter-sweep'
  | 'prompt-ab'
  | 'hypothesis-test'
  | 'knowledge-injection'
  | 'adversarial'
  | 'stress'
  | 'regression';

export type TestCategory = 'demo' | 'test' | 'benchmark' | 'research';

export interface TestStep {
  input: string;
  type?: 'belief' | 'question' | 'goal' | 'chat' | 'command';
  label?: string;
  waitMs?: number;
  runSteps?: number;
}

export interface TestExpectation {
  afterSteps?: number;
  contains?: string[];
  notContains?: string[];
  equals?: string;
  minTruthF?: number;
  maxTruthF?: number;
  minTruthC?: number;
  maxTruthC?: number;
  minDerivations?: number;
  maxDerivations?: number;
  minScore?: number;
  maxDuration?: number;
  memorySize?: [number, number];
}

export interface TestVariant {
  name: string;
  parameterOverrides?: Record<string, any>;
  inputOverrides?: Partial<TestStep>[];
}

export interface UnifiedTest {
  id: string;
  name: string;
  description: string;
  steps: TestStep[];
  expectation?: TestExpectation;
  type: TestType;
  parameters?: Record<string, {min?: number; max?: number; step?: number; values?: any[]}>;
  variants?: TestVariant[];
  category: TestCategory;
  tags?: string[];
  weight?: number;
}

export interface TestResult {
  testId: string;
  passed: boolean;
  score: number;
  details: TestDetail[];
  trajectory: TrajectoryStep[];
  beliefs: string[];
  derivations: number;
  duration: number;
  comparison?: VariantComparison;
  error?: string;
}

export interface TestDetail {
  description: string;
  passed: boolean;
  score: number;
  detail?: string;
}

export interface TrajectoryStep {
  step: number;
  input: string;
  output?: string;
  derivations?: number;
  timestamp: number;
}

export interface VariantComparison {
  baseline: string;
  variants: Array<{
    name: string;
    score: number;
    delta: number;
    significant: boolean;
  }>;
}

export class UnifiedTestRunner {
  constructor(private nar: NAR) {}

  async run(test: UnifiedTest): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      switch (test.type) {
        case 'single':
        case 'regression':
          return await this.runSingle(test, startTime);
        case 'parameter-sweep':
          return await this.runParameterSweep(test, startTime);
        case 'prompt-ab':
        case 'hypothesis-test':
          return await this.runVariantTest(test, startTime);
        default:
          throw new Error(`Unsupported test type: ${test.type}`);
      }
    } catch (error) {
      return {
        testId: test.id,
        passed: false,
        score: 0,
        details: [],
        trajectory: [],
        beliefs: [],
        derivations: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async runSingle(test: UnifiedTest, startTime: number): Promise<TestResult> {
    await this.nar.clearMemory();
    
    const beliefsBefore = this.nar.getBeliefs().length;
    const trajectory: TrajectoryStep[] = [];
    
    for (const [idx, step] of test.steps.entries()) {
      await this.nar.input(step.input);
      const cycles = step.runSteps ?? 3;
      const derived = await this.nar.run(cycles);
      
      trajectory.push({
        step: idx,
        input: step.input,
        derivations: derived,
        timestamp: Date.now()
      });
    }
    
    const beliefs = this.nar.getBeliefs().map(b => b.term.toString());
    const derivations = beliefs.length - beliefsBefore;
    
    const details = this.evaluateExpectations(test.expectation, { beliefs, derivations });
    const score = details.length > 0 ? details.reduce((sum, d) => sum + d.score, 0) / details.length : 1.0;
    
    return {
      testId: test.id,
      passed: details.every(d => d.passed),
      score,
      details,
      trajectory,
      beliefs,
      derivations,
      duration: Date.now() - startTime
    };
  }

  private async runParameterSweep(test: UnifiedTest, startTime: number): Promise<TestResult> {
    if (!test.parameters || Object.keys(test.parameters).length === 0) {
      return await this.runSingle(test, startTime);
    }

    const combinations = this.generateCombinations(test.parameters);
    const results: Array<{params: Record<string, any>, score: number, passed: boolean}> = [];
    
    for (const params of combinations) {
      const modifiedTest: UnifiedTest = {
        ...test,
        steps: test.steps.map(step => ({
          ...step,
          runSteps: params.depth as number || step.runSteps
        }))
      };
      
      const result = await this.runSingle(modifiedTest, startTime);
      results.push({ params, score: result.score, passed: result.passed });
    }
    
    const bestScore = Math.max(...results.map(r => r.score));
    const comparison: VariantComparison = {
      baseline: 'default',
      variants: results.map((r, idx) => ({
        name: Object.entries(r.params).map(([k, v]) => `${k}=${v}`).join('_'),
        score: r.score,
        delta: r.score - bestScore,
        significant: Math.abs(r.score - bestScore) > 0.1
      }))
    };
    
    return {
      testId: test.id,
      passed: results.some(r => r.passed),
      score: bestScore,
      details: [],
      trajectory: [],
      beliefs: [],
      derivations: 0,
      duration: Date.now() - startTime,
      comparison
    };
  }

  private async runVariantTest(test: UnifiedTest, startTime: number): Promise<TestResult> {
    if (!test.variants || test.variants.length === 0) {
      return await this.runSingle(test, startTime);
    }

    const baseline = await this.runSingle(test, startTime);
    const variantResults = [];
    
    for (const variant of test.variants) {
      const modifiedTest: UnifiedTest = { ...test };
      
      if (variant.parameterOverrides) {
        modifiedTest.parameters = { ...test.parameters, ...variant.parameterOverrides };
      }
      
      if (variant.inputOverrides) {
        modifiedTest.steps = test.steps.map((step, idx) => {
          const override = variant.inputOverrides![idx];
          return override ? { ...step, ...override } : step;
        });
      }
      
      variantResults.push(await this.runSingle(modifiedTest, startTime));
    }
    
    const comparison: VariantComparison = {
      baseline: test.variants[0]?.name || 'baseline',
      variants: variantResults.map((result, idx) => ({
        name: test.variants![idx + 1]?.name || `variant-${idx}`,
        score: result.score,
        delta: result.score - baseline.score,
        significant: Math.abs(result.score - baseline.score) > 0.1
      }))
    };
    
    return {
      testId: test.id,
      passed: baseline.passed,
      score: baseline.score,
      details: baseline.details,
      trajectory: baseline.trajectory,
      beliefs: baseline.beliefs,
      derivations: baseline.derivations,
      duration: Date.now() - startTime,
      comparison
    };
  }

  private evaluateExpectations(
    expectation: TestExpectation | undefined,
    context: { beliefs: string[]; derivations: number }
  ): TestDetail[] {
    if (!expectation) {
      return [{ description: 'No expectations', passed: true, score: 1.0 }];
    }

    const details: TestDetail[] = [];
    
    if (expectation.contains) {
      for (const term of expectation.contains) {
        const passed = context.beliefs.some(b => b.includes(term));
        details.push({
          description: `Contains: ${term}`,
          passed,
          score: passed ? 1.0 : 0.0
        });
      }
    }

    if (expectation.notContains) {
      for (const term of expectation.notContains) {
        const passed = context.beliefs.every(b => !b.includes(term));
        details.push({
          description: `Not contains: ${term}`,
          passed,
          score: passed ? 1.0 : 0.0
        });
      }
    }

    if (expectation.minDerivations !== undefined) {
      const passed = context.derivations >= expectation.minDerivations;
      details.push({
        description: `Min derivations: ${expectation.minDerivations}`,
        passed,
        score: passed ? 1.0 : Math.min(1.0, context.derivations / expectation.minDerivations),
        detail: `Got ${context.derivations}`
      });
    }

    if (expectation.maxDerivations !== undefined) {
      const passed = context.derivations <= expectation.maxDerivations;
      details.push({
        description: `Max derivations: ${expectation.maxDerivations}`,
        passed,
        score: passed ? 1.0 : Math.min(1.0, expectation.maxDerivations / context.derivations),
        detail: `Got ${context.derivations}`
      });
    }

    return details.length > 0 ? details : [{ description: 'Default', passed: true, score: 1.0 }];
  }

  private generateCombinations(params: Record<string, {min?: number; max?: number; step?: number; values?: any[]}>): Record<string, any>[] {
    const keys = Object.keys(params);
    if (keys.length === 0) return [{}];
    
    const [firstKey, ...restKeys] = keys;
    const firstParam = params[firstKey!];
    const firstValues = firstParam?.values || this.range(firstParam?.min || 0, firstParam?.max || 0, firstParam?.step || 1);
    const restParams: any = {};
    restKeys.forEach(k => { restParams[k] = params[k]; });
    const restCombinations = this.generateCombinations(restParams);
    
    return firstValues.flatMap((firstVal: any) =>
      restCombinations.map((rest: any) => ({
        [firstKey!]: firstVal,
        ...rest
      }))
    );
  }

  private range(min: number, max: number, step: number): number[] {
    const result: number[] = [];
    for (let i = min; i <= max; i += step) {
      result.push(i);
    }
    return result;
  }
}

export function createUnifiedTestRunner(nar: NAR): UnifiedTestRunner {
  return new UnifiedTestRunner(nar);
}

export function defineTest(spec: Omit<UnifiedTest, 'id' | 'type' | 'category'> & {id: string; type?: TestType; category?: TestCategory}): UnifiedTest {
  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    steps: spec.steps,
    expectation: spec.expectation,
    type: spec.type || 'single',
    parameters: spec.parameters,
    variants: spec.variants,
    category: spec.category || 'test',
    tags: spec.tags,
    weight: spec.weight
  };
}

export const Tests = {
  transitive: (depth = 3) => defineTest({
    id: 'transitive-inference',
    name: 'Transitive Inference',
    description: 'Test A→B, B→C ⊢ A→C',
    steps: [
      { input: '<A --> B>.', type: 'belief', runSteps: depth },
      { input: '<B --> C>.', type: 'belief', runSteps: depth }
    ],
    expectation: {
      contains: ['(A --> C)'],
      minDerivations: 1
    },
    category: 'test'
  }),

  operationMisuse: () => defineTest({
    id: 'operation-misuse-check',
    name: 'Operation Misuse Detection',
    description: 'Verify no ^ operators in declarative reasoning',
    steps: [
      { input: '<cat --> animal>.', type: 'belief' }
    ],
    expectation: {
      notContains: ['^'],
      maxDerivations: 5
    },
    category: 'test'
  }),

  premiseRelevance: () => defineTest({
    id: 'premise-relevance',
    name: 'Premise Relevance Test',
    description: 'Test that related concepts are prioritized',
    steps: [
      { input: '<cat --> animal>.', type: 'belief' },
      { input: '<dog --> animal>.', type: 'belief' }
    ],
    expectation: {
      contains: ['cat', 'animal'],
      minDerivations: 1
    },
    category: 'benchmark'
  })
};
