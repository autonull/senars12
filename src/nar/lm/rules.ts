import { LMRule } from './LMRule.js';
import type { LMClient, LMRuleConfig } from './types.js';
import type { Term } from '../terms/index.js';
import { Truth } from '../terms/truth.js';
import { createTask, createBudget } from '../task/task.js';

interface LMRuleDefinition {
  id: string;
  name: string;
  description: string;
  promptTemplate: string;
  priority: number;
  taskGenerator: (response: string, primary: Term) => any[];
  singlePremise?: boolean;
}

const createRule = (lm: LMClient | null, def: LMRuleDefinition, config: Partial<LMRuleConfig> = {}): LMRule => {
  return new LMRule(def.id, lm, {
    ...config,
    name: def.name,
    description: def.description,
    singlePremise: def.singlePremise ?? true,
    priority: def.priority,
    promptTemplate: def.promptTemplate,
    taskGenerator: def.taskGenerator
  });
};

const simpleTaskGenerator = (response: string, primary: Term, type: any = 'belief', budget = 0.6) => {
  if (!response) return [];
  return [createTask({ kind: 'atom' as const, symbol: response.trim(), hash: 0 }, type, Truth.NEUTRAL, createBudget(budget))];
};

const ruleDefs: LMRuleDefinition[] = [
  {
    id: 'lm-narsese-translation',
    name: 'LMNarseseTranslationRule',
    description: 'Translates natural language to Narsese',
    priority: 0.9,
    promptTemplate: 'Translate the following sentence into Narsese logic (NARS format). Sentence: "{{taskTerm}}"',
    taskGenerator: (response) => {
      if (!response) return [];
      try {
        const termStr = response.includes('-->') ? response.trim() : response.trim();
        return [createTask({ kind: 'atom' as const, symbol: termStr, hash: 0 }, 'belief', Truth.NEUTRAL, createBudget(0.9))];
      } catch { return []; }
    }
  },
  {
    id: 'lm-belief-revision',
    name: 'LMBeliefRevisionRule',
    description: 'Revises belief confidence based on context',
    priority: 0.8,
    promptTemplate: 'Given the belief "{{primaryTerm}}", should its confidence be revised? Consider context and evidence.',
    taskGenerator: (response, primary) => simpleTaskGenerator(response, primary, 'belief', 0.7)
  },
  {
    id: 'lm-goal-decomposition',
    name: 'LMGoalDecompositionRule',
    description: 'Decomposes complex goals into subgoals',
    priority: 0.85,
    promptTemplate: 'Decompose the goal "{{primaryTerm}}" into simpler subgoals. List them step by step.',
    taskGenerator: (response) => {
      if (!response) return [];
      return response.split('\n').filter(l => l.trim()).map(subgoal =>
        createTask({ kind: 'atom' as const, symbol: subgoal.trim(), hash: 0 }, 'goal', Truth.NEUTRAL, createBudget(0.8))
      );
    }
  },
  { id: 'lm-hypothesis-generation', name: 'LMHypothesisGenerationRule', description: 'Generates hypotheses from observations', priority: 0.75, promptTemplate: 'Given the observation "{{primaryTerm}}", what are possible explanations or hypotheses?', taskGenerator: (r, p) => simpleTaskGenerator(r, p, 'belief', 0.6) },
  { id: 'lm-explanation-generation', name: 'LMExplanationGenerationRule', description: 'Generates explanations for beliefs', priority: 0.7, promptTemplate: 'Explain why "{{primaryTerm}}" might be true. Provide reasoning.', taskGenerator: (r, p) => simpleTaskGenerator(r, p, 'belief', 0.65) },
  { id: 'lm-analogical-reasoning', name: 'LMAnalogicalReasoningRule', description: 'Performs analogical reasoning between concepts', priority: 0.8, promptTemplate: 'What is analogous to "{{primaryTerm}}"? Find similar patterns or structures.', taskGenerator: (r, p) => simpleTaskGenerator(r, p, 'belief', 0.7) },
  { id: 'lm-meta-reasoning', name: 'LMMetaReasoningGuidanceRule', description: 'Provides meta-level reasoning guidance', priority: 0.75, promptTemplate: 'What reasoning strategy should be used for "{{primaryTerm}}"? Suggest approach.', taskGenerator: (r, p) => simpleTaskGenerator(r, p, 'belief', 0.65) },
  { id: 'lm-uncertainty-calibration', name: 'LMUncertaintyCalibrationRule', description: 'Calibrates confidence based on uncertainty', priority: 0.7, promptTemplate: 'Assess the uncertainty in "{{primaryTerm}}". How confident should we be?', taskGenerator: (r, p) => simpleTaskGenerator(r, p, 'belief', 0.6) },
  { id: 'lm-schema-induction', name: 'LMSchemaInductionRule', description: 'Induces schemas from patterns', priority: 0.75, promptTemplate: 'What general schema or pattern can be induced from "{{primaryTerm}}"?', taskGenerator: (r, p) => simpleTaskGenerator(r, p, 'belief', 0.65) },
  { id: 'lm-temporal-causal', name: 'LMTemporalCausalModelingRule', description: 'Models temporal and causal relationships', priority: 0.8, promptTemplate: 'What is the causal or temporal relationship in "{{primaryTerm}}"?', taskGenerator: (r, p) => simpleTaskGenerator(r, p, 'belief', 0.7) },
  { id: 'lm-variable-grounding', name: 'LMVariableGroundingRule', description: 'Grounds variables in concrete instances', priority: 0.75, promptTemplate: 'Ground the variables in "{{primaryTerm}}" to specific instances.', taskGenerator: (r, p) => simpleTaskGenerator(r, p, 'belief', 0.65) },
  { id: 'lm-concept-elaboration', name: 'LMConceptElaborationRule', description: 'Elaborates on concepts with additional details', priority: 0.7, promptTemplate: 'Elaborate on the concept "{{primaryTerm}}". Provide more details.', taskGenerator: (r, p) => simpleTaskGenerator(r, p, 'belief', 0.6) },
  { id: 'lm-interactive-clarification', name: 'LMInteractiveClarificationRule', description: 'Asks clarifying questions', priority: 0.65, promptTemplate: 'What clarification is needed for "{{primaryTerm}}"?', taskGenerator: (r, p) => simpleTaskGenerator(r, p, 'question', 0.5) }
];

export const createLMRule = (id: string, lm: LMClient | null, config: Partial<LMRuleConfig> = {}): LMRule | undefined => {
  const def = ruleDefs.find(d => d.id === id);
  return def ? createRule(lm, def, config) : undefined;
};

export const createAllLMRules = (lm: LMClient | null, config: Partial<LMRuleConfig> = {}): LMRule[] =>
  ruleDefs.map(def => createRule(lm, def, config));

export const LMRules = {
  createNarseseTranslationRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[0]!, config),
  createBeliefRevisionRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[1]!, config),
  createGoalDecompositionRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[2]!, config),
  createHypothesisGenerationRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[3]!, config),
  createExplanationGenerationRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[4]!, config),
  createAnalogicalReasoningRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[5]!, config),
  createMetaReasoningGuidanceRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[6]!, config),
  createUncertaintyCalibrationRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[7]!, config),
  createSchemaInductionRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[8]!, config),
  createTemporalCausalModelingRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[9]!, config),
  createVariableGroundingRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[10]!, config),
  createConceptElaborationRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[11]!, config),
  createInteractiveClarificationRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[12]!, config),
  createAll: createAllLMRules
};
