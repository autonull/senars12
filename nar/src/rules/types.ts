import type { StampType, Term, Truth } from '../terms';

export interface RuleInput {
  term: Term;
  truth: Truth;
  stamp: StampType;
}

export interface RuleResult {
  term: Term;
  truth: Truth;
  stamp: StampType;
  priority: number;
  taskType?: 'belief' | 'goal' | 'question' | 'command';
}

/** A unit of model-backed rule work: staged by the cycle, applied outside it. */
export interface LMRuleWork {
  p1: RuleInput;
  p2?: RuleInput;
}

/**
 * Where staged work goes. One bounded backlog, owned by the seam the cycle
 * reaches a provider through — a second queue would be a second account of the
 * same backlog (TODO29.a A1).
 */
export interface LMRuleWorkSink {
  /** `false` when the declared overflow policy refused the work. */
  stage(work: LMRuleWork): boolean;
}

/** Engine port consumed by derivation strategies — keeps `strategies/` free of the processor implementation. */
export interface RuleEngine {
  processSync(p1: RuleInput, p2: RuleInput): RuleResult[];
  /**
   * Stage model-backed rule work for the off-cycle pass. Synchronous by
   * construction: the cycle may not await a provider, and a strategy that could
   * await one would put the cycle's progress behind a model again.
   */
  stageLMRules(p1: RuleInput, p2?: RuleInput): boolean;
}

export type TruthFn = (t1: Truth, t2: Truth) => Truth | null;

export type RulePattern = {
  left: { op?: string; subject?: string };
  right: { op?: string; subject?: string };
};

export type RuleFn = (premises: [Term, Term]) => Term | undefined;

export interface RegisteredRule {
  id: string;
  pattern: RulePattern;
  apply: RuleFn;
  sync: boolean;
  priority: number;
  truthFn?: TruthFn;
  taskType?: 'belief' | 'goal' | 'question' | 'command';
}

export interface RuleDef {
  readonly id: string;
  readonly description: string;
  readonly pattern: [Term['kind'], Term['kind']];
  readonly build: RuleFn;
  readonly truth: keyof typeof Truth;
  readonly priority: number;
}

export const createRulePattern = (leftOp?: string, rightOp?: string): RulePattern => ({
  left: { op: leftOp },
  right: { op: rightOp },
});

export interface RuleStatistics {
  hitCount: number;
  lastHitTime: number;
  successRate: number;
  avgDuration: number;
}

export interface RuleDependency {
  ruleId: string;
  dependsOn: string[];
  producesFor: string[];
}
