import type { ModelRuleStats } from '@senars/util';
import type { NarEventBus, Task } from '../types';
import type { StampType, Term, Truth } from '../terms';

import { type Timestamp } from '../types/primitives.js';

export interface RuleInput {
  term: Term;
  truth: Truth;
  stamp: StampType;
  occurrenceTime: Timestamp;
}

export interface RuleResult {
  term: Term;
  truth: Truth;
  stamp: StampType;
  priority: number;
  taskType?: 'belief' | 'goal' | 'question' | 'command';
}

/**
 * What the cycle requires of a model-backed rule, in core vocabulary.
 *
 * The induction layer's `LMRule` satisfies this structurally and is never named
 * by it: a core extension contract typed in the layer's vocabulary is the
 * coupling a type boundary is supposed to remove (TODO29.a §5.2). Everything
 * here is data or a term — no closure over NAR internals.
 */
export interface ModelRule {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly priority: number;
  /** The term a selector matches this rule against. */
  readonly condition: Term;
  /** Whether the rule derives symbolically when its model call fails or is refused. */
  readonly hasSymbolicFallback: boolean;
  canApply(primary: Term, secondary?: Term, context?: Record<string, unknown>): boolean;
  apply(
    primary: Term,
    secondary?: Term,
    context?: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<Task[]>;
  getStats(): ModelRuleStats;
  setEventBus(eventBus: NarEventBus): void;
  enable(): void;
  disable(): void;
}

/** A unit of model-backed rule work: staged by the cycle, applied outside it. */
export interface ModelRuleWork {
  p1: RuleInput;
  p2?: RuleInput;
}

/**
 * The memory-wide half of a model rule's prompt: concept count, memory pressure,
 * conflict count, drive intensity. Identical for every task in one pump, so the
 * flush reads it once and passes it down. Prompt hints, never load-bearing.
 */
export interface RulePromptContext {
  totalConcepts: number;
  memoryPressure: number;
  conflictCount: number;
  driveState: Record<string, number>;
}

/**
 * Where staged work goes. One bounded backlog, owned by the seam the cycle
 * reaches a provider through — a second queue would be a second account of the
 * same backlog (TODO29.a A1).
 */
export interface ModelRuleWorkSink {
  /** `false` when the declared overflow policy refused the work. */
  stage(work: ModelRuleWork): boolean;
}

/** Engine port consumed by derivation strategies — keeps `strategies/` free of the processor implementation. */
export interface RuleEngine {
  processSync(p1: RuleInput, p2: RuleInput): RuleResult[];
  /**
   * Stage model-backed rule work for the off-cycle pass. Synchronous by
   * construction: the cycle may not await a provider, and a strategy that could
   * await one would put the cycle's progress behind a model again.
   */
  stageModelRuleWork(p1: RuleInput, p2?: RuleInput): boolean;
}

export type TruthFn = (t1: Truth, t2: Truth) => Truth | null;

/**
 * A rule's dispatch cell. Both sides are required: a wildcard bucket had zero
 * registered rules and three lookups on the innermost path, so a rule that does
 * not declare its kinds does not register (TODO29.a §5.6).
 */
export type RulePattern = {
  left: { op: Term['kind']; subject?: string };
  right: { op: Term['kind']; subject?: string };
};

/**
 * Dispatch, as a port: what inference code depends on, independent of how
 * candidates are found. `RuleIndex` is one implementation, and replacing it is
 * one file (TODO29.a §5.6).
 */
export interface InferenceTable {
  register(rule: RegisteredRule): void;
  candidates(left: Term['kind'], right: Term['kind']): readonly RegisteredRule[];
  clear(): void;
}

/**
 * A rule function that can optionally receive RuleInputs for temporal reasoning.
 * The second parameter is provided by the processor when available (for temporal rules).
 */
export type RuleFn = (
  premises: [Term, Term],
  inputs?: [RuleInput, RuleInput]
) => Term | undefined;

export interface RegisteredRule {
  id: string;
  pattern: RulePattern;
  apply: RuleFn;
  sync: boolean;
  priority: number;
  truthFn?: TruthFn;
  /**
   * The declared name of {@link truthFn}, kept beside it rather than recovered
   * from it. A derivation step has to name the algebra operation it applied for
   * the standalone verifier to recompute it, and the closure is not
   * serialisable — so the table's string artifact is carried through to the
   * record instead of being resolved by matching the rule id.
   */
  truthFnName?: string;
  taskType?: 'belief' | 'goal' | 'question' | 'command';
}

/**
 * A rule as declared. The body is a **name**, never a closure: the table's
 * artifact has to be serialisable into an event log, and a rule is only real if
 * its body resolves (TODO29.a §5.10).
 */
export interface RuleDef {
  readonly id: string;
  readonly description: string;
  readonly pattern: [Term['kind'], Term['kind']];
  /** Namespaced body name: `nal:<fn>` or `nal.extended:<fn>`. */
  readonly body: string;
  readonly truth: keyof typeof Truth;
  readonly priority: number;
}

export const createRulePattern = (
  leftOp: Term['kind'],
  rightOp: Term['kind']
): RulePattern => ({
  left: { op: leftOp },
  right: { op: rightOp },
});
