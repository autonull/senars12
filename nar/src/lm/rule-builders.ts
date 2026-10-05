/**
 * Shared builders for LM rules: prompt constants, response parsing, and the
 * `createRule` / `createCustomRule` factories used by the LMRuleFactory.
 *
 * A builder takes a definition; it never looks one up. The registry owns that
 * search (`rule-templates/index.ts`), and a builder that imported it to search
 * its own definitions is what made every template import this module.
 */
import type { Term } from '../terms';
import { Truth } from '../terms';
import type { Task, TaskType } from '../types';
import { createTask, createTaskWeight } from '../types';
import { LMResponseParser, LMRule } from './LMRule.js';
import type { LMRuleConfig, LMService } from './lm-service.js';
import type {
  LMRuleDefinition,
  RuleActivation,
  RuleFallback,
} from './rule-templates/definition.js';

export type { LMRuleDefinition } from './rule-templates/definition.js';

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

const NARSESE_INSTRUCTIONS = `
You are a reasoning assistant that responds in Narsese format.
Use these Narsese operators:
- inheritance: (A --> B) means "A is a kind of B"
- similarity: (A <-> B) means "A is similar to B"
- implication: (A => B) means "if A then B"
- equivalence: (A <=> B) means "A if and only if B"
- conjunction: (A & B) means "both A and B"
- disjunction: (A | B) means "either A or B"

Respond with a single Narsese statement or JSON:
{"narsese": "(A --> B)", "truth": {"f": 0.8, "c": 0.9}}
`.trim();

const responseToTask = (response: string, type: TaskType, budget: number): Task => {
  if (!response)
    return createTask(
      { kind: 'atom' as const, symbol: 'TRUE' },
      type,
      Truth.NEUTRAL,
      createTaskWeight(budget)
    );
  const parsed = LMResponseParser.parse(response);
  return parsed.valid && parsed.term
    ? createTask(parsed.term, type, parsed.truth, createTaskWeight(budget))
    : createTask(
        { kind: 'atom' as const, symbol: response.trim() },
        type,
        Truth.NEUTRAL,
        createTaskWeight(budget)
      );
};

const parseResponse = (response: string, type: TaskType, budget: number): Task[] => {
  if (!response) return [];
  return response
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => responseToTask(line, type, budget));
};

const createTaskGen = (type: TaskType, budget: number) => (_r: unknown, _p: unknown) => {
  const response = typeof _r === 'string' ? _r : String(_r);
  return [responseToTask(response, type, budget)];
};

const asUnknownCondition = (
  fn: RuleActivation | undefined
):
  | ((primary: unknown, secondary?: unknown, context?: Record<string, unknown>) => boolean)
  | undefined =>
  fn
    ? (p: unknown, s?: unknown, c?: Record<string, unknown>) => fn(p as Term, s as Term, c)
    : undefined;

const createCustomRule = (
  id: string,
  lm: LMService | null,
  config: LMRuleFactoryConfig
): LMRule => {
  const taskType = config.taskType ?? 'belief';
  const budget = config.budget ?? 0.7;
  return new LMRule(id, lm, {
    name: config.name ?? id,
    description: config.description ?? 'Custom LM rule',
    priority: config.priority ?? 0.8,
    singlePremise: config.singlePremise ?? true,
    activationCondition: asUnknownCondition(config.activationCondition),
    promptTemplate: config.promptTemplate ?? `Reason about: {{primaryTerm}}`,
    fallback: (config.fallback ?? (() => null)) as LMRuleConfig['fallback'],
    taskGenerator: config.multiline
      ? (r: unknown) => parseResponse(String(r), taskType, budget)
      : createTaskGen(taskType, budget),
  });
};

const createRule = (
  lm: LMService | null,
  def: LMRuleDefinition,
  config: Omit<Partial<LMRuleConfig>, 'activationCondition' | 'fallback'> & {
    activationCondition?: RuleActivation;
    fallback?: RuleFallback | LMRuleConfig['fallback'];
  } = {}
): LMRule => {
  const taskType = def.taskType ?? 'belief';
  const budget = def.budget ?? 0.7;
  return new LMRule(def.id, lm, {
    ...config,
    name: def.name,
    description: def.description,
    priority: def.priority,
    singlePremise: def.singlePremise ?? true,
    activationCondition: asUnknownCondition(config.activationCondition ?? def.activationCondition),
    promptTemplate: `${NARSESE_INSTRUCTIONS}\n\n${def.prompt}`,
    taskType,
    outputSchema: def.schema,
    enableTools: def.enableTools,
    constitutionAware: def.constitutionAware,
    grammar: def.grammar,
    maxOutputTokens: def.maxOutputTokens,
    fallback: (config.fallback ?? def.fallback) as LMRuleConfig['fallback'],
    taskGenerator: def.multiline
      ? (r: unknown) => parseResponse(String(r), taskType, budget)
      : createTaskGen(taskType, budget),
  });
};

export { createCustomRule, createRule, createTaskGen, NARSESE_INSTRUCTIONS, parseResponse };
