import type { Task, TaskType } from '../types';
import { LMRule } from './LMRule';
import type { LMRuleConfig, LMService } from './lm-service';
import type { LMRuleDefinition, RuleActivation, RuleFallback } from './rule-templates/definition';
export type { LMRuleDefinition } from './rule-templates/definition';
export interface LMRuleFactoryConfig {
    id?: string;
    name?: string;
    description?: string;
    priority?: number;
    promptTemplate?: string;
    taskType?: TaskType;
    budget?: number;
    multiline?: boolean;
    singlePremise?: boolean;
    activationCondition?: RuleActivation;
    /** Pure-NAL symbolic body. Optional on a custom rule, which then declares "none". */
    fallback?: RuleFallback;
}
declare const NARSESE_INSTRUCTIONS: string;
declare const parseResponse: (response: string, type: TaskType, budget: number) => Task[];
declare const createTaskGen: (type: TaskType, budget: number) => (_r: unknown, _p: unknown) => Task[];
declare const createCustomRule: (id: string, lm: LMService | null, config: LMRuleFactoryConfig) => LMRule;
declare const createRule: (lm: LMService | null, def: LMRuleDefinition, config?: Omit<Partial<LMRuleConfig>, 'activationCondition' | 'fallback'> & {
    activationCondition?: RuleActivation;
    fallback?: RuleFallback | LMRuleConfig['fallback'];
}) => LMRule;
export { createCustomRule, createRule, createTaskGen, NARSESE_INSTRUCTIONS, parseResponse };
//# sourceMappingURL=rule-builders.d.ts.map