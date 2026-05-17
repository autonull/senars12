import type {NAR} from '../../nar/nar.js';

export type ScenarioStepType = 'belief' | 'question' | 'goal' | 'chat' | 'command';

export interface ScenarioStep {
    input: string;
    type?: ScenarioStepType;
    label?: string;
    waitMs?: number;
    runSteps?: number;
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

export interface ScenarioExpectation {
    afterSteps?: number;
    derivations?: ExpectedDerivation[];
    responseContains?: string;
    responseNotContains?: string[];
    toolCalls?: string[];
    toolCallsNot?: string[];
    minScore?: number;
    maxDuration?: number;
    memorySize?: [number, number];
}

export type ScenarioCategory = 'demo' | 'test' | 'benchmark';

export interface Scenario {
    id: string;
    name: string;
    category: ScenarioCategory;
    tags?: string[];
    description: string;
    steps: ScenarioStep[];
    expectation?: ScenarioExpectation;
    weight?: number;
    setup?: (nar: NAR) => Promise<void>;
    teardown?: (nar: NAR) => Promise<void>;
}

export interface TrajectoryStep {
    step: number;
    input: string;
    response?: string;
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
    passed: boolean;
    score: number;
    details: AssertionResult[];
    trajectory: TrajectoryStep[];
    beliefsBefore: number;
    beliefsAfter: number;
    derivedCount: number;
    duration: number;
    error?: string;
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