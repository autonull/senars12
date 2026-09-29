import type { LMRule } from '../lm/rule/LMRule.js';
import type { Concept } from '../memory/concept.js';
import type { MemoryView } from '../memory/view.js';
import type { RuleEngine } from '../rules/types.js';
import type { Task } from '../types';
import type { Term } from '../terms';

// ── Shared ───────────────────────────────────
export interface ComponentMetadata {
  readonly name: string;
  readonly description: string;
  readonly version?: string;
}

export type StrategyType = 'sampling' | 'premise' | 'derivation' | 'lm-rule' | 'attention';

/** Every plugin shape the registry can hold. */
export type StrategyImpl =
  | SamplingStrategy
  | Strategy
  | DerivationStrategy
  | LMRuleSelector
  | AttentionModel;

// ── 1. SamplingStrategy ──────────────────────
export interface SamplingStrategy {
  readonly metadata: ComponentMetadata;

  sample(memory: MemoryView, count: number): Concept[];
}

// ── 2. Strategy (Premise Selection) ───────────
export interface Strategy {
  readonly metadata?: ComponentMetadata;
  readonly name: string;
  readonly sampleSize?: number;
  readonly limit?: number;

  selectSecondary(task: Task, memory: MemoryView): Task[];
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
    processor: RuleEngine,
    context: DerivationContext
  ): AsyncGenerator<Task>;
}

// ── 4. LMRuleSelector ─────────────────────────
export interface LMRuleSelectionContext {
  maxRules: number;
  rotationIndex?: number;
  conceptPriority: number;
  premiseCount: 1 | 2;
  focusTerm?: Term;
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
  memory: MemoryView;
}

export interface AttentionModel {
  readonly metadata: ComponentMetadata;

  prime(concept: Concept, context: AttentionContext): number;

  decay(concept: Concept, cyclesElapsed: number, baseDecayRate: number): number;

  tick(memory: MemoryView, cycleCount: number): void;
}

// ── MetricsSummary ────────────────────────────
export interface MetricsSummary {
  rules: Array<{
    id: string;
    executions: number;
    successes: number;
    failures: number;
    averageDuration: number;
  }>;
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


