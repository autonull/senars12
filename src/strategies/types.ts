import type { Concept } from '../memory/concept';
import type { MemoryView } from '../memory/view';
import type { ModelRule, RuleEngine } from '../rules/types';
import type { Task } from '../types';
import type { Term } from '../terms';

// ── Shared ───────────────────────────────────
export interface ComponentMetadata {
  readonly name: string;
  readonly description: string;
  readonly version?: string;
}

/** Common shape every strategy implementation carries. */
export interface WithMetadata {
  readonly metadata: ComponentMetadata;
}

export type StrategyType = 'sampling' | 'premise' | 'derivation' | 'lm-rule' | 'attention';

/** Every plugin shape the registry can hold. */
export type StrategyImpl =
  | SamplingStrategy
  | Strategy
  | DerivationStrategy
  | ModelRuleSelector
  | AttentionModel;

// ── 1. SamplingStrategy ──────────────────────
export interface SamplingStrategy extends WithMetadata {
  sample(memory: MemoryView, count: number): Concept[];
}

// ── 2. Strategy (Premise Selection) ───────────
export interface Strategy extends WithMetadata {
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

export interface DerivationStrategy extends WithMetadata {
  derive(
    primary: Task,
    secondaries: Task[],
    processor: RuleEngine,
    context: DerivationContext
  ): AsyncGenerator<Task>;
}

// ── 4. ModelRuleSelector ──────────────────────
export interface ModelRuleSelectionContext {
  maxRules: number;
  rotationIndex?: number;
  conceptPriority: number;
  premiseCount: 1 | 2;
  focusTerm?: Term;
}

/**
 * Which registered model-backed rules to apply, given the work budget.
 *
 * Selection is a *proposal-time* concern rather than a reasoning-cycle strategy:
 * the cycle stages work unconditionally and the selector runs in the off-cycle
 * pass, so nothing on the cycle path is decided here.
 */
export interface ModelRuleSelector extends WithMetadata {
  select(rules: ModelRule[], context: ModelRuleSelectionContext): ModelRule[];
}

// ── 5. AttentionModel ─────────────────────────
export interface AttentionContext {
  concept: Concept;
  task?: Task;
  cycleCount: number;
  memory: MemoryView;
}

export interface AttentionModel extends WithMetadata {
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
