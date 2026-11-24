import type { StepExecutor } from '../../../kernel/step';
import type { Premise, StepResult, RuleCategory, RuleId } from '../../../kernel/step';
import { Stamp } from '../../../kernel/stamp';
import { Term } from '../../../kernel/terms/intern';
import { NAL_RULES } from './table';

/** Rule application engine. */
export class NALRuleEngine {
  private executor: StepExecutor;

  constructor(executor: StepExecutor) {
    this.executor = executor;
    this.registerRules();
  }

  /** Register all NAL rules with the executor. */
  private registerRules(): void {
    for (const rule of NAL_RULES) {
      this.executor.registerRule({
        id: rule.id,
        name: rule.name,
        category: rule.category,
        arity: rule.arity,
        premiseRoles: rule.premiseRoles,
        truthOp: rule.truthOp as any,
        priority: rule.priority,
        builtin: true,
        condition: rule.condition,
        buildConclusion: rule.buildConclusion,
      });
    }
  }

  /** Apply all applicable rules to premises. */
  applyRules(premises: Premise[], options?: { categories?: RuleCategory[]; limit?: number }): StepResult[] {
    return this.executor.applyAllRules(premises, options);
  }

  /** Generate steps from a bag. */
  generateSteps(
    bagEntries: Array<{ term: Term; truth: import('../../../kernel/truth').TruthValue; stamp: Stamp }>,
    options?: { maxPairs?: number; categories?: RuleCategory[] }
  ): StepResult[] {
    return this.executor.generateSteps(bagEntries, options);
  }
}

/** Create a NAL rule engine. */
export function createNALRuleEngine(executor: StepExecutor): NALRuleEngine {
  return new NALRuleEngine(executor);
}