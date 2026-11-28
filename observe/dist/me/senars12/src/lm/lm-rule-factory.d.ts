/**
 * LM Rule Factory - Unified factory for LM-based inference rules.
 * Orchestrates the rule templates, builders, and selectors defined in sibling modules.
 */
import type { Term } from '../terms';
import type { Task } from '../types';
import type { LMRule } from './LMRule';
import type { LMService } from './lm-service';
import type { LMRuleFactoryConfig } from './rule-builders';
export type { LMRuleDefinition } from './rule-templates/definition';
export type { LMRuleFactoryConfig } from './rule-builders';
export { LMRules } from './rule-selectors/factory';
export declare class LMRuleFactory {
    private readonly config;
    private readonly lm;
    constructor(lm: LMService | null, config?: LMRuleFactoryConfig);
    static from(lm: LMService | null): LMRuleFactory;
    id(id: string): this;
    name(name: string): this;
    description(desc: string): this;
    priority(p: number): this;
    prompt(template: string): this;
    taskType(type: Task['type'] | string): this;
    budget(b: number): this;
    multiline(ml: boolean): this;
    activation(fn: (primary: Term, secondary?: Term, context?: Record<string, unknown>) => boolean): this;
    singlePremise(sp: boolean): this;
    createAll(): LMRule[];
    build(): LMRule;
    /**
     * Build one of the shipped rules by id, with this factory's overrides applied.
     * There were nineteen named wrappers over this call and eighteen of them had
     * no caller in the tree; the id is the rule's own name, and a wrapper per rule
     * is a list to keep in step with {@link ruleDefs}.
     */
    preset(id: string): LMRule;
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
export declare function createConfiguredLMRules(lm: LMService | null, specs: readonly ConfiguredRuleSpec[]): {
    rules: LMRule[];
    unknownIds: string[];
};
//# sourceMappingURL=lm-rule-factory.d.ts.map