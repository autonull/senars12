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

/** Engine port consumed by derivation strategies — keeps `strategies/` free of the processor implementation. */
export interface RuleEngine {
  processSync(p1: RuleInput, p2: RuleInput): RuleResult[];
  processLMRules(
    p1: RuleInput,
    p2?: RuleInput,
    opts?: { signal?: AbortSignal; singlePremise?: boolean }
  ): AsyncGenerator<RuleResult>;
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
