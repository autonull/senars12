/**
 * LM Rule Factory - Unified factory for LM-based inference rules.
 * Orchestrates the rule templates, builders, and selectors defined in sibling modules.
 */
import type { Term } from '../terms';
import type { Task } from '../types';
import { LMRule } from './LMRule.js';
import type { LMRuleConfig, LMService } from './lm-service.js';
import type { LMRuleDefinition, LMRuleFactoryConfig } from './rule-builders.js';
import { createCustomRule, createRule, getRuleDef } from './rule-builders.js';
import { ruleDefs } from './rule-templates/index.js';
import { LMRules } from './rule-selectors/factory.js';

export { LMRules } from './rule-selectors/factory.js';
export type { LMRuleDefinition, LMRuleFactoryConfig } from './rule-builders.js';
export * from './dynamic-rule.js';

export class LMRuleFactory {
  private readonly config: LMRuleFactoryConfig;
  private readonly lm: LMService | null;

  constructor(lm: LMService | null, config: LMRuleFactoryConfig = {}) {
    this.lm = lm;
    this.config = config;
  }

  static from(lm: LMService | null): LMRuleFactory {
    return new LMRuleFactory(lm);
  }

  id(id: string): this {
    this.config.id = id;
    return this;
  }

  name(name: string): this {
    this.config.name = name;
    return this;
  }

  description(desc: string): this {
    this.config.description = desc;
    return this;
  }

  priority(p: number): this {
    this.config.priority = p;
    return this;
  }

  prompt(template: string): this {
    this.config.promptTemplate = template;
    return this;
  }

  taskType(type: Task['type'] | string): this {
    this.config.taskType = type as LMRuleFactoryConfig['taskType'];
    return this;
  }

  budget(b: number): this {
    this.config.budget = b;
    return this;
  }

  multiline(ml: boolean): this {
    this.config.multiline = ml;
    return this;
  }

  activation(
    fn: (primary: Term, secondary?: Term, context?: Record<string, unknown>) => boolean
  ): this {
    this.config.activationCondition = fn;
    return this;
  }

  singlePremise(sp: boolean): this {
    this.config.singlePremise = sp;
    return this;
  }

  narseseTranslation(): LMRule {
    return this.preset('lm-narsese-translation');
  }

  beliefRevision(): LMRule {
    return this.preset('lm-belief-revision');
  }

  goalDecomposition(): LMRule {
    return this.preset('lm-goal-decomposition');
  }

  hypothesisGeneration(): LMRule {
    return this.preset('lm-hypothesis-generation');
  }

  explanationGeneration(): LMRule {
    return this.preset('lm-explanation-generation');
  }

  analogicalReasoning(): LMRule {
    return this.preset('lm-analogical-reasoning');
  }

  metaReasoning(): LMRule {
    return this.preset('lm-meta-reasoning');
  }

  uncertaintyCalibration(): LMRule {
    return this.preset('lm-uncertainty-calibration');
  }

  schemaInduction(): LMRule {
    return this.preset('lm-schema-induction');
  }

  temporalCausal(): LMRule {
    return this.preset('lm-temporal-causal');
  }

  variableGrounding(): LMRule {
    return this.preset('lm-variable-grounding');
  }

  conceptElaboration(): LMRule {
    return this.preset('lm-concept-elaboration');
  }

  interactiveClarification(): LMRule {
    return this.preset('lm-interactive-clarification');
  }

  curiosityQuestion(): LMRule {
    return this.preset('lm-curiosity-question');
  }

  v2Hypothesis(): LMRule {
    return this.preset('lm-v2-hypothesis');
  }

  v2Explanation(): LMRule {
    return this.preset('lm-v2-explanation');
  }

  v2Analogy(): LMRule {
    return this.preset('lm-v2-analogy');
  }

  v2Causal(): LMRule {
    return this.preset('lm-v2-causal');
  }

  v2Schema(): LMRule {
    return this.preset('lm-v2-schema');
  }

  createAll(): LMRule[] {
    return ruleDefs.map((d) => createRule(this.lm, d));
  }

  build(): LMRule {
    const id = this.config.id;
    if (!id) throw new Error('LMRuleFactory: id is required when building custom rules');
    const def = ruleDefs.find((d) => d.id === id);
    if (def) return createRule(this.lm, def, this.config);
    return createCustomRule(id, this.lm, this.config);
  }

  private preset(id: string): LMRule {
    return createRule(this.lm, getRuleDef(id), this.config);
  }
}
