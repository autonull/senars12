import type { ZodSchema } from 'zod';
import {
  AnalogySchema,
  BeliefRevisionSchema,
  ConceptElaborationSchema,
  ExplanationSchema,
  GoalDecompositionSchema,
  HypothesisSchema,
  MetaReasoningSchema,
  QuestionGenerationSchema,
  SchemaInductionSchema,
  TemporalCausalSchema,
  TranslationSchema,
  UncertaintySchema,
  VariableGroundingSchema,
} from '../nl';
/**
 * LM Rule Factory - Unified factory for LM-based inference rules
 * Consolidates rules.ts, dynamic-rules.ts, and rule-factory-v2.ts presets into a single factory
 */
import type { Term } from '../terms';
import {
  Truth,
  calculateSimilarity,
  isConjunction,
  isDisjunction,
  isInheritance,
  sharesSymbol,
  visitTerms,
} from '../terms';
import type { Task, TaskType } from '../types';
import { createBudget, createTask } from '../types';
import { LMResponseParser, LMRule } from './LMRule.js';
import type { LMRuleConfig, LMService } from './lm-service.js';

export interface LMRuleDefinition {
  id: string;
  name: string;
  description: string;
  priority: number;
  singlePremise?: boolean;
  taskType?: TaskType;
  budget?: number;
  multiline?: boolean;
  activationCondition?: (
    primary: Term,
    secondary?: Term,
    context?: Record<string, unknown>
  ) => boolean;
  schema?: ZodSchema;
  enableTools?: boolean;
  constitutionAware?: boolean;
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

const parseResponse = (response: string, type: TaskType, budget: number): Task[] => {
  if (!response) return [];
  return response
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => {
      const parsed = LMResponseParser.parse(line);
      const term =
        parsed.valid && parsed.term ? parsed.term : { kind: 'atom' as const, symbol: line.trim() };
      return createTask(term, type, parsed.truth, createBudget(budget));
    });
};

const createTaskGen = (type: TaskType, budget: number) => (_r: unknown, _p: Term) => {
  const response = typeof _r === 'string' ? _r : String(_r);
  const parsed = LMResponseParser.parse(response);
  return parsed.valid && parsed.term
    ? [createTask(parsed.term, type, parsed.truth, createBudget(budget))]
    : [
        createTask(
          { kind: 'atom' as const, symbol: response.trim() },
          type,
          Truth.NEUTRAL,
          createBudget(budget)
        ),
      ];
};

// Activation condition helpers
export const hasVariable = (term: Term): boolean => {
  const str = term.toString();
  return /\?[0-9a-zA-Z_]/.test(str);
};

export const isUnderconnected = (
  _primary: Term,
  _secondary?: Term,
  ctx?: Record<string, unknown>
): boolean => {
  const linkCount = (ctx?.linkCount as number) ?? 0;
  const avgLinks = (ctx?.avgLinksPerConcept as number) ?? 5;
  return linkCount < avgLinks * 0.3;
};

export const hasLowConfidence = (
  primary: Term,
  _secondary?: Term,
  ctx?: Record<string, unknown>
): boolean => {
  const truth = ctx?.truth as { f?: number; c?: number } | undefined;
  return truth ? (truth.c ?? 0) < 0.5 : false;
};

export const hasConflictingBeliefs = (
  _primary: Term,
  _secondary?: Term,
  ctx?: Record<string, unknown>
): boolean => {
  return ((ctx?.conflictCount as number) ?? 0) > 0;
};

export const isComplexGoal = (primary: Term): boolean => {
  if (isConjunction(primary) || isDisjunction(primary)) return true;
  let inheritanceCount = 0;
  visitTerms(primary, (t) => {
    if (isInheritance(t)) inheritanceCount++;
  });
  return inheritanceCount > 1;
};

export const hasStructuralSimilarityNoOverlap = (primary: Term, secondary?: Term): boolean => {
  if (!secondary) return false;
  const sim = calculateSimilarity(primary, secondary);
  return sim > 0.6 && !sharesSymbol(primary, secondary);
};

export const hasHighCuriosity = (
  _primary: Term,
  _secondary?: Term,
  ctx?: Record<string, unknown>
): boolean => {
  const driveState = ctx?.driveState as Record<string, number> | undefined;
  return (driveState?.curiosity ?? 0) > 0.6;
};

// Preset rule definitions
const ruleDefs: LMRuleDefinition[] = [
  {
    id: 'lm-narsese-translation',
    name: 'LMNarseseTranslationRule',
    description: 'Translates natural language to Narsese',
    priority: 0.9,
    taskType: 'belief',
    budget: 0.9,
    schema: TranslationSchema,
  },
  {
    id: 'lm-belief-revision',
    name: 'LMBeliefRevisionRule',
    description: 'Revises belief confidence based on context',
    priority: 0.8,
    taskType: 'belief',
    budget: 0.7,
    activationCondition: hasConflictingBeliefs,
    schema: BeliefRevisionSchema,
    constitutionAware: true,
  },
  {
    id: 'lm-goal-decomposition',
    name: 'LMGoalDecompositionRule',
    description: 'Decomposes complex goals into subgoals',
    priority: 0.85,
    taskType: 'goal',
    budget: 0.8,
    singlePremise: true,
    activationCondition: isComplexGoal,
    schema: GoalDecompositionSchema,
    enableTools: true,
    constitutionAware: true,
  },
  {
    id: 'lm-hypothesis-generation',
    name: 'LMHypothesisGenerationRule',
    description: 'Generates hypotheses from observations',
    priority: 0.75,
    taskType: 'belief',
    budget: 0.6,
    activationCondition: hasLowConfidence,
    schema: HypothesisSchema,
    enableTools: true,
    constitutionAware: true,
  },
  {
    id: 'lm-explanation-generation',
    name: 'LMExplanationGenerationRule',
    description: 'Generates explanations for beliefs',
    priority: 0.7,
    taskType: 'belief',
    budget: 0.65,
    schema: ExplanationSchema,
  },
  {
    id: 'lm-analogical-reasoning',
    name: 'LMAnalogicalReasoningRule',
    description: 'Performs analogical reasoning between concepts',
    priority: 0.8,
    taskType: 'belief',
    budget: 0.7,
    activationCondition: hasStructuralSimilarityNoOverlap,
    schema: AnalogySchema,
    enableTools: true,
  },
  {
    id: 'lm-meta-reasoning',
    name: 'LMMetaReasoningGuidanceRule',
    description: 'Provides meta-level reasoning guidance',
    priority: 0.75,
    taskType: 'belief',
    budget: 0.65,
    schema: MetaReasoningSchema,
  },
  {
    id: 'lm-uncertainty-calibration',
    name: 'LMUncertaintyCalibrationRule',
    description: 'Calibrates uncertainty in beliefs',
    priority: 0.7,
    taskType: 'belief',
    budget: 0.6,
    schema: UncertaintySchema,
  },
  {
    id: 'lm-schema-induction',
    name: 'LMSchemaInductionRule',
    description: 'Induces schemas from examples',
    priority: 0.75,
    taskType: 'belief',
    budget: 0.65,
    schema: SchemaInductionSchema,
  },
  {
    id: 'lm-temporal-causal',
    name: 'LMTemporalCausalModelingRule',
    description: 'Models temporal and causal relationships',
    priority: 0.8,
    taskType: 'belief',
    budget: 0.7,
    schema: TemporalCausalSchema,
  },
  {
    id: 'lm-variable-grounding',
    name: 'LMVariableGroundingRule',
    description: 'Grounds variables in concrete instances',
    priority: 0.7,
    taskType: 'belief',
    budget: 0.65,
    activationCondition: (p) => hasVariable(p),
    schema: VariableGroundingSchema,
  },
  {
    id: 'lm-concept-elaboration',
    name: 'LMConceptElaborationRule',
    description: 'Elaborates on concept properties',
    priority: 0.75,
    taskType: 'belief',
    budget: 0.7,
    activationCondition: isUnderconnected,
    schema: ConceptElaborationSchema,
  },
  {
    id: 'lm-curiosity-question',
    name: 'LMCuriosityQuestionRule',
    description: 'Generates questions driven by curiosity',
    priority: 0.7,
    taskType: 'question',
    budget: 0.65,
    singlePremise: true,
    activationCondition: hasHighCuriosity,
    schema: QuestionGenerationSchema,
  },
  {
    id: 'lm-interactive-clarification',
    name: 'LMInteractiveClarificationRule',
    description: 'Seeks clarification for ambiguous inputs',
    priority: 0.7,
    taskType: 'question',
    budget: 0.65,
  },
  // V2 preset rules (merged from rule-factory-v2.ts)
  {
    id: 'lm-v2-hypothesis',
    name: 'LMV2HypothesisRule',
    description: 'Generates typed hypotheses with truth values',
    priority: 0.75,
    taskType: 'belief',
    singlePremise: true,
    schema: HypothesisSchema,
  },
  {
    id: 'lm-v2-explanation',
    name: 'LMV2ExplanationRule',
    description: 'Generates typed explanations with key premises',
    priority: 0.7,
    taskType: 'belief',
    singlePremise: true,
    schema: ExplanationSchema,
  },
  {
    id: 'lm-v2-analogy',
    name: 'LMV2AnalogyRule',
    description: 'Finds structural analogies between concepts',
    priority: 0.8,
    taskType: 'belief',
    schema: AnalogySchema,
  },
  {
    id: 'lm-v2-causal',
    name: 'LMV2CausalRule',
    description: 'Models causal relationships',
    priority: 0.8,
    taskType: 'belief',
    schema: TemporalCausalSchema,
  },
  {
    id: 'lm-v2-schema',
    name: 'LMV2SchemaRule',
    description: 'Induces reusable schemas from patterns',
    priority: 0.75,
    taskType: 'belief',
    singlePremise: true,
    schema: SchemaInductionSchema,
  },
];

const prompts: Record<string, string> = {
  'lm-narsese-translation':
    'Translate the following sentence into Narsese logic. Sentence: "{{taskTerm}}"',
  'lm-belief-revision': 'Given "{{primaryTerm}}", should its confidence be revised?',
  'lm-goal-decomposition': 'Decompose the goal "{{primaryTerm}}" into simpler subgoals.',
  'lm-hypothesis-generation': 'Given "{{primaryTerm}}", what are possible explanations?',
  'lm-explanation-generation': 'Explain why "{{primaryTerm}}" might be true.',
  'lm-analogical-reasoning': 'What is analogous to "{{primaryTerm}}"?',
  'lm-meta-reasoning': 'Analyze the reasoning for "{{primaryTerm}}".',
  'lm-uncertainty-calibration': 'For "{{primaryTerm}}", what confidence level is appropriate?',
  'lm-schema-induction': 'From "{{primaryTerm}}", what schema can be induced?',
  'lm-temporal-causal': 'What temporal/causal relationships involve "{{primaryTerm}}"?',
  'lm-variable-grounding': 'What concrete instances ground "{{primaryTerm}}"?',
  'lm-concept-elaboration': 'Elaborate on "{{primaryTerm}}". What are its properties?',
  'lm-curiosity-question':
    'Given "{{primaryTerm}}" and curiosity drive, what questions should be asked? Generate Narsese questions. Respond with JSON: {"questions": [{"narsese": "?term", "relevance": 0.8, "rationale": "..."}]}',
  'lm-interactive-clarification': 'What clarification is needed for "{{primaryTerm}}"?',
  'lm-v2-hypothesis':
    'You are a NARS hypothesis generator. Given: {{primaryTerm}}. Generate a plausible hypothesis in Narsese with truth values. Respond with JSON: {"narsese": "(...)", "truth": {"f": 0.8, "c": 0.7}, "rationale": "..."}',
  'lm-v2-explanation':
    'You are a NARS explanation generator. Explain why: {{primaryTerm}}. Respond with JSON: {"explanation": "...", "confidence": 0.8, "keyPremises": ["..."]}',
  'lm-v2-analogy':
    'You are an analogical reasoning system. Source: {{primaryTerm}}. Target: {{secondaryTerm}}. Find structural analogies. Respond with JSON: {"analogies": [{"source": "...", "target": "...", "mapping": "..."}]}',
  'lm-v2-causal':
    'You are a causal reasoning system. Analyze causal relationships for: {{primaryTerm}}. Respond with JSON: {"relations": [{"cause": "...", "effect": "...", "type": "direct|enabling|preventing", "confidence": 0.8}]}',
  'lm-v2-schema':
    'You are a schema induction system. Pattern: {{primaryTerm}}. Induce a reusable schema. Respond with JSON: {"schema": "...", "instances": ["..."], "confidence": 0.8}',
};

interface LMRuleFactoryConfig {
  id?: string;
  name?: string;
  description?: string;
  priority?: number;
  promptTemplate?: string;
  taskType?: TaskType;
  budget?: number;
  multiline?: boolean;
  singlePremise?: boolean;
  activationCondition?: (
    primary: Term,
    secondary?: Term,
    context?: Record<string, unknown>
  ) => boolean;
}

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

  taskType(type: TaskType): this {
    this.config.taskType = type;
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
    activationCondition: config.activationCondition,
    promptTemplate: config.promptTemplate ?? `Reason about: {{primaryTerm}}`,
    taskGenerator: config.multiline
      ? (r: unknown) => parseResponse(String(r), taskType, budget)
      : createTaskGen(taskType, budget),
  });
};

const createRule = (
  lm: LMService | null,
  def: LMRuleDefinition,
  config: Partial<LMRuleConfig> = {}
): LMRule => {
  const taskType = def.taskType ?? 'belief';
  const budget = def.budget ?? 0.7;
  return new LMRule(def.id, lm, {
    ...config,
    name: def.name,
    description: def.description,
    priority: def.priority,
    singlePremise: def.singlePremise ?? true,
    activationCondition: def.activationCondition,
    promptTemplate: `${NARSESE_INSTRUCTIONS}\n\n${prompts[def.id]}`,
    taskType,
    outputSchema: def.schema,
    enableTools: def.enableTools,
    constitutionAware: def.constitutionAware,
    taskGenerator: def.multiline
      ? (r: unknown) => parseResponse(String(r), taskType, budget)
      : createTaskGen(taskType, budget),
  });
};

const getRuleDef = (id: string): LMRuleDefinition => {
  const def = ruleDefs.find((d) => d.id === id);
  if (!def) throw new Error(`Rule definition '${id}' not found`);
  return def;
};

// Backward compatibility - LMRules object
export const LMRules = Object.freeze({
  createById: (id: string, lm: LMService | null, config?: Partial<LMRuleConfig>): LMRule =>
    createRule(lm, getRuleDef(id), config),
  createAll: (lm: LMService | null, config?: Partial<LMRuleConfig>): LMRule[] =>
    ruleDefs.map((d) => createRule(lm, d, config)),
  ruleDefs,
});

// Dynamic Rule Generator (consolidated from dynamic-rules.ts)
export interface DynamicRuleConfig extends Partial<LMRuleConfig> {
  name: string;
  description: string;
  naturalLanguageDescription: string;
  promptTemplate?: string;
  validationRules?: ValidationRule[];
}

export interface ValidationRule {
  type: 'narsese' | 'json' | 'custom';
  pattern?: string;
  validator?: (response: string) => boolean;
  message: string;
}

export class DynamicLMRuleGenerator {
  private readonly lm: LMService;
  private readonly baseConfig: Partial<LMRuleConfig>;

  constructor(lm: LMService, baseConfig?: Partial<LMRuleConfig>) {
    this.lm = lm;
    this.baseConfig = baseConfig ?? {};
  }

  async generateRuleFromDescription(description: string): Promise<LMRule | null> {
    const prompt = `
You are a NARS reasoning system configuration generator.
Given a natural language description of a reasoning rule, generate a rule configuration.

Description: ${description}

Generate a rule in this format:
{
  "id": "rule-id",
  "name": "Rule Name",
  "description": "Description",
  "priority": 0.8,
  "promptTemplate": "Template with {{primaryTerm}} placeholder"
}

Respond with JSON only:
`.trim();

    try {
      const response = await this.lm.generateText(prompt);
      const config = this.parseRuleConfig(response, description);
      return config ? new LMRule(config.id!, this.lm, config) : null;
    } catch {
      return null;
    }
  }

  createRuleFromTemplate(
    id: string,
    name: string,
    description: string,
    promptTemplate: string,
    priority = 0.8
  ): LMRule {
    return new LMRule(id, this.lm, {
      ...this.baseConfig,
      id,
      name,
      description,
      priority,
      promptTemplate,
      singlePremise: true,
    });
  }

  validateResponse(
    response: string,
    rules: ValidationRule[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const rule of rules) {
      switch (rule.type) {
        case 'narsese':
          if (!this.validateNarsese(response, rule.message, errors)) {
            errors.push(rule.message);
          }
          break;
        case 'json':
          if (!this.validateJSON(response, rule.message, errors)) {
            errors.push(rule.message);
          }
          break;
        case 'custom':
          if (rule.validator && !rule.validator(response)) {
            errors.push(rule.message);
          }
          break;
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private validateNarsese(response: string, message: string, errors: string[]): boolean {
    try {
      const parsed = LMResponseParser.parse(response);
      if (!parsed.valid) {
        errors.push(message || 'Invalid Narsese format');
        return false;
      }
      return true;
    } catch {
      errors.push(message || 'Failed to parse Narsese');
      return false;
    }
  }

  private validateJSON(response: string, message: string, errors: string[]): boolean {
    try {
      JSON.parse(response);
      return true;
    } catch {
      errors.push(message || 'Invalid JSON format');
      return false;
    }
  }

  private parseRuleConfig(response: string, description: string): LMRuleConfig | null {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const obj = JSON.parse(jsonMatch[0]);
      return {
        id: obj.id || `dynamic-rule-${Date.now()}`,
        name: obj.name || 'Dynamic Rule',
        description: obj.description || description,
        priority: obj.priority ?? 0.8,
        promptTemplate: obj.promptTemplate || `Reason about: {{primaryTerm}}`,
        singlePremise: true,
      };
    } catch {
      return {
        id: `dynamic-rule-${Date.now()}`,
        name: 'Dynamic Rule',
        description,
        priority: 0.8,
        promptTemplate: `Reason about: {{primaryTerm}}`,
        singlePremise: true,
      };
    }
  }
}

export class CompositeLMRule extends LMRule {
  private readonly componentRules: LMRule[] = [];

  constructor(id: string, lm: LMService, config: LMRuleConfig) {
    super(id, lm, config);
  }

  addRule(rule: LMRule): void {
    this.componentRules.push(rule);
  }

  override async apply(
    primary: Term,
    secondary?: Term,
    context?: Record<string, unknown>
  ): Promise<Task[]> {
    const allTasks: Task[] = [];

    for (const rule of this.componentRules) {
      try {
        const tasks = await rule.apply(primary, secondary, context);
        allTasks.push(...tasks);
      } catch {
        // expected: individual rule failure shouldn't abort other rules
      }
    }

    return allTasks;
  }

  override canApply(primary: Term, secondary?: Term, context?: Record<string, unknown>): boolean {
    return this.componentRules.some((rule) => rule.canApply(primary, secondary, context));
  }
}

export const createDynamicRuleGenerator = (
  lm: LMService,
  baseConfig?: Partial<LMRuleConfig>
): DynamicLMRuleGenerator => {
  return new DynamicLMRuleGenerator(lm, baseConfig);
};

export const createCompositeRule = (
  id: string,
  lm: LMService,
  config: LMRuleConfig
): CompositeLMRule => {
  return new CompositeLMRule(id, lm, config);
};
