import type {Concept, Memory} from '../memory';
import type {Task} from '../types';
import type {RuleProcessor} from '../rules';
import type {LMRule} from '../lm';

// ── Shared ───────────────────────────────────
export interface ComponentMetadata {
    readonly name: string;
    readonly description: string;
    readonly version?: string;
}

export type StrategyType = 'sampling' | 'premise' | 'derivation' | 'lm-rule' | 'attention';

// ── 1. SamplingStrategy ──────────────────────
export interface SamplingStrategy {
    readonly metadata: ComponentMetadata;

    sample(memory: Memory, count: number): Concept[];
}

// ── 2. Strategy (Premise Selection) ───────────
export interface Strategy {
    readonly metadata?: ComponentMetadata;
    readonly name: string;
    readonly sampleSize?: number;
    readonly limit?: number;

    selectSecondary(task: Task, memory: Memory): Task[];
}

// ── 3. DerivationStrategy ─────────────────────
export interface DerivationContext {
    maxDerivations: number;
    maxDepth: number;
    cpuThrottleMs: number;
    singlePremiseEnabled: boolean;
    signal?: AbortSignal;
}

export interface DerivationStrategy {
    readonly metadata: ComponentMetadata;

    derive(
        primary: Task,
        secondaries: Task[],
        processor: RuleProcessor,
        context: DerivationContext
    ): AsyncGenerator<Task>;
}

// ── 4. LMRuleSelector ─────────────────────────
export interface LMRuleSelectionContext {
    maxRules: number;
    rotationIndex?: number;
    conceptPriority: number;
    premiseCount: 1 | 2;
}

export interface LMRuleSelector {
    readonly metadata: ComponentMetadata;

    select(rules: LMRule[], context: LMRuleSelectionContext): LMRule[];
}

// ── 5. AttentionModel ─────────────────────────
export interface AttentionContext {
    concept: Concept;
    task?: Task;
    cycleCount: number;
    memory: Memory;
}

export interface AttentionModel {
    readonly metadata: ComponentMetadata;

    prime(concept: Concept, context: AttentionContext): number;

    decay(concept: Concept, cyclesElapsed: number, baseDecayRate: number): number;

    tick(memory: Memory, cycleCount: number): void;
}

// ── MetricsSummary ────────────────────────────
export interface MetricsSummary {
    rules: Array<{ id: string; executions: number; successes: number; failures: number; averageDuration: number }>;
    memory: { conceptCount: number; utilization: number } | null;
    lm: { totalCalls: number; averageLatency: number; failedCalls: number } | null;
    throughput: { derivationsPerSecond: number; averageStepDuration: number } | null;
    system: { totalDerivations: number; totalSteps: number; uptime: number };
}

// ── Search Space ──────────────────────────────
export interface SearchSpaceParam {
    type: 'float' | 'int' | 'categorical' | 'boolean';
    min?: number;
    max?: number;
    values?: unknown[];
    log?: boolean;
}

export interface SearchSpace {
    parameters: Record<string, SearchSpaceParam>;
}

// ── StrategyRegistry ──────────────────────────
export interface StrategyRegistry {
    register(type: StrategyType, name: string, impl: SamplingStrategy | Strategy | DerivationStrategy | LMRuleSelector | AttentionModel): void;

    get<T>(type: StrategyType, name: string): T;

    list(type: StrategyType): ComponentMetadata[];

    has(type: StrategyType, name: string): boolean;

    unregister(type: StrategyType, name: string): boolean;

    composePremise(strategies: Array<{ name: string; weight: number }>): Strategy;

    createAdaptive(strategies: string[]): Strategy;
}
