/**
 * LM Rule Factory - Unified factory for LM-based inference rules.
 * Orchestrates the rule templates, builders, and selectors defined in sibling modules.
 */
import type { Term } from '../terms';
import type { Task } from '../types';
import type { LMRule } from './LMRule.js';
import type { LMService } from './lm-service.js';
import type { LMRuleFactoryConfig } from './rule-builders.js';
import { createCustomRule, createRule } from './rule-builders.js';
import { getRuleDef, ruleDefs } from './rule-templates/index.js';

export type { LMRuleDefinition } from './rule-templates/definition.js';
export type { LMRuleFactoryConfig } from './rule-builders.js';
export { LMRules } from './rule-selectors/factory.js';

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

  /**
   * Build one of the shipped rules by id, with this factory's overrides applied.
   * There were nineteen named wrappers over this call and eighteen of them had
   * no caller in the tree; the id is the rule's own name, and a wrapper per rule
   * is a list to keep in step with {@link ruleDefs}.
   */
  preset(id: string): LMRule {
    return createRule(this.lm, getRuleDef(id), this.config);
  }
}

export interface ConfiguredRuleSpec {
  id: string;
  name?: string;
  description?: string;
  priority?: number;
  prompt?: string;
  taskType?: string;
  budget?: number;
  multiline?: boolean;
  singlePremise?: boolean;
  enabled?: boolean;
}

/**
 * Builds LM rules from validated config entries (senars.config.json `bot.lmRules.rules`).
 * Entries whose id matches a built-in template are built as presets; others are custom rules.
 * Returns unknown ids so callers can log them.
 */
export function createConfiguredLMRules(
  lm: LMService | null,
  specs: readonly ConfiguredRuleSpec[]
): { rules: LMRule[]; unknownIds: string[] } {
  const factory = LMRuleFactory.from(lm);
  const rules: LMRule[] = [];
  const unknownIds: string[] = [];
  for (const spec of specs) {
    const { enabled, prompt, ...config } = spec;
    const factoryConfig: LMRuleFactoryConfig = {
      ...config,
      taskType: config.taskType as LMRuleFactoryConfig['taskType'],
      ...(prompt ? { promptTemplate: prompt } : {}),
    };
    factory.id(spec.id);
    const def = ruleDefs.find((d) => d.id === spec.id);
    const rule = def
      ? createRule(lm, def, factoryConfig)
      : createCustomRule(spec.id, lm, factoryConfig);
    if (!def) unknownIds.push(spec.id);
    if (enabled === false) rule.disable();
    rules.push(rule);
  }
  return { rules, unknownIds };
}
