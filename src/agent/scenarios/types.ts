import type {NAR} from '../../nar/nar.js';
import type {Task, Term} from '../../nar/types/index.js';

export type ScenarioStepType = 'belief' | 'question' | 'goal' | 'chat' | 'command';

export type ScenarioType =
    | 'single'
    | 'parameter-sweep'
    | 'prompt-ab'
    | 'hypothesis-test'
    | 'regression'
    | 'adversarial'
    | 'stress';

export type ScenarioCategory = 'demo' | 'test' | 'benchmark' | 'research';

export interface ScenarioStep {
    input: string;
    type?: ScenarioStepType;
    label?: string;
    waitMs?: number;
    runSteps?: number;
}

export interface ScenarioExpectation {
    contains?: string[];
    notContains?: string[];
    minDerivations?: number;
    maxDerivations?: number;
    minTruthF?: number;
    maxTruthF?: number;
    minTruthC?: number;
    maxTruthC?: number;
    minScore?: number;
    maxDuration?: number;
    memorySize?: [number, number];
    toolCalls?: string[];
    toolCallsNot?: string[];
    responseContains?: string;
    responseNotContains?: string[];
    afterSteps?: number;
    expectedDerivations?: ExpectedDerivation[];
}

export interface ScenarioVariant {
    name: string;
    parameterOverrides?: Record<string, any>;
    inputOverrides?: Partial<ScenarioStep>[];
}

export interface Scenario {
    id: string;
    name: string;
    description: string;
    type?: ScenarioType;
    category: ScenarioCategory;
    tags?: string[];
    weight?: number;
    steps: ScenarioStep[];
    expectation?: ScenarioExpectation;
    parameters?: Record<string, {min?: number; max?: number; step?: number; values?: any[]}>;
    variants?: ScenarioVariant[];
    setup?: (nar: NAR) => Promise<void>;
    teardown?: (nar: NAR) => Promise<void>;
}

export interface TrajectoryStep {
    step: number;
    input: string;
    response?: string;
    output?: string;
    derivations?: number;
    timestamp: number;
}

export interface AssertionResult {
    description: string;
    passed: boolean;
    score: number;
    detail?: string;
}

export interface ScenarioResult {
    scenario: Scenario;
    testId?: string;
    passed: boolean;
    score: number;
    details: AssertionResult[];
    trajectory: TrajectoryStep[];
    beliefs: string[];
    beliefsBefore?: number;
    beliefsAfter?: number;
    derivations: number;
    derivedCount?: number;
    duration: number;
    comparison?: VariantComparison;
    error?: string;
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

export interface ExpectedDerivation {
    contains?: string;
    equals?: string;
    minTruthF?: number;
    minTruthC?: number;
    maxTruthF?: number;
    maxTruthC?: number;
    minCount?: number;
    maxCount?: number;
    ruleIds?: string[];
}

export interface BenchmarkReport {
    suite: string;
    timestamp: number;
    totalScenarios: number;
    passed: number;
    failed: number;
    score: number;
    results: ScenarioResult[];
}

export interface ExperimentConfig {
    type: 'parameter-sweep' | 'prompt-ab' | 'hypothesis-test' | 'knowledge-injection' | 'tool-composition' | 'strategy-comparison' | 'adversarial-test' | 'stress-test';
    name: string;
    description: string;
    parameters?: Record<string, {min?: number; max?: number; step?: number; values?: unknown[]}>;
    promptVariants?: string[];
    hypothesis?: string;
    beliefs?: string[];
    testQueries?: string[];
    verdictThreshold?: number;
    adversarialInputs?: string[];
    expectedBehavior?: string;
    testScenario?: string;
    objective?: string;
}

export interface ExperimentResult {
    experimentId: string;
    score: number;
    details: Record<string, unknown>;
    duration: number;
}

export interface Experiment {
    id: string;
    name: string;
    type: ExperimentConfig['type'];
    description: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    config: ExperimentConfig;
    results?: ExperimentResult;
    createdAt: number;
    completedAt?: number;
}

export type {Task, Term};
