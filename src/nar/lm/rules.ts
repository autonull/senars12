import { LMRule } from './LMRule.js';
import type { LMClient, LMRuleConfig } from './types.js';
import type { Term } from '../terms/index.js';
import type { Task } from '../task/task.js';
import { Truth } from '../terms/truth.js';
import { createTask } from '../task/task.js';

function createTermFromNarsese(termStr: string, termFactory?: any): Term {
  if (!termFactory) {
    return { kind: 'atom' as const, symbol: termStr, hash: 0 };
  }
  return termFactory.create(termStr);
}

export function createNarseseTranslationRule(lm: LMClient | null, config: Partial<LMRuleConfig> = {}): LMRule {
  return new LMRule('lm-narsese-translation', lm, {
    ...config,
    name: 'LMNarseseTranslationRule',
    description: 'Translates natural language to Narsese',
    singlePremise: true,
    priority: 0.9,
    promptTemplate: 'Translate the following sentence into Narsese logic (NARS format). Sentence: "{{taskTerm}}"',
    taskGenerator: (response: string, primary: Term) => {
      if (!response) return [];
      try {
        const termStr = response.includes('-->') ? response.trim() : response.trim();
        const term = { kind: 'atom' as const, symbol: termStr, hash: 0 };
        return [createTask(term, 'belief', Truth.NEUTRAL, 0.9)];
      } catch {
        return [];
      }
    }
  });
}

export function createBeliefRevisionRule(lm: LMClient | null, config: Partial<LMRuleConfig> = {}): LMRule {
  return new LMRule('lm-belief-revision', lm, {
    ...config,
    name: 'LMBeliefRevisionRule',
    description: 'Revises belief confidence based on context',
    priority: 0.8,
    promptTemplate: 'Given the belief "{{primaryTerm}}", should its confidence be revised? Consider context and evidence.',
    taskGenerator: (response: string, primary: Term) => {
      if (!response) return [];
      return [createTask(primary, 'belief', Truth.NEUTRAL, 0.7)];
    }
  });
}

export function createGoalDecompositionRule(lm: LMClient | null, config: Partial<LMRuleConfig> = {}): LMRule {
  return new LMRule('lm-goal-decomposition', lm, {
    ...config,
    name: 'LMGoalDecompositionRule',
    description: 'Decomposes complex goals into subgoals',
    priority: 0.85,
    promptTemplate: 'Decompose the goal "{{primaryTerm}}" into simpler subgoals. List them step by step.',
    taskGenerator: (response: string, primary: Term) => {
      if (!response) return [];
      const subgoals = response.split('\n').filter(line => line.trim());
      return subgoals.map(subgoal => createTask({ kind: 'atom' as const, symbol: subgoal.trim(), hash: 0 }, 'goal', Truth.NEUTRAL, 0.8));
    }
  });
}

export function createHypothesisGenerationRule(lm: LMClient | null, config: Partial<LMRuleConfig> = {}): LMRule {
  return new LMRule('lm-hypothesis-generation', lm, {
    ...config,
    name: 'LMHypothesisGenerationRule',
    description: 'Generates hypotheses from observations',
    priority: 0.75,
    promptTemplate: 'Given the observation "{{primaryTerm}}", what are possible explanations or hypotheses?',
    taskGenerator: (response: string, primary: Term) => {
      if (!response) return [];
      return [createTask({ kind: 'atom' as const, symbol: response.trim(), hash: 0 }, 'belief', Truth.NEUTRAL, 0.6)];
    }
  });
}

export function createExplanationGenerationRule(lm: LMClient | null, config: Partial<LMRuleConfig> = {}): LMRule {
  return new LMRule('lm-explanation-generation', lm, {
    ...config,
    name: 'LMExplanationGenerationRule',
    description: 'Generates explanations for beliefs',
    priority: 0.7,
    promptTemplate: 'Explain why "{{primaryTerm}}" might be true. Provide reasoning.',
    taskGenerator: (response: string, primary: Term) => {
      if (!response) return [];
      return [createTask({ kind: 'atom' as const, symbol: response.trim(), hash: 0 }, 'belief', Truth.NEUTRAL, 0.65)];
    }
  });
}

export function createAnalogicalReasoningRule(lm: LMClient | null, config: Partial<LMRuleConfig> = {}): LMRule {
  return new LMRule('lm-analogical-reasoning', lm, {
    ...config,
    name: 'LMAnalogicalReasoningRule',
    description: 'Performs analogical reasoning between concepts',
    priority: 0.8,
    promptTemplate: 'What is analogous to "{{primaryTerm}}"? Find similar patterns or structures.',
    taskGenerator: (response: string, primary: Term) => {
      if (!response) return [];
      return [createTask({ kind: 'atom' as const, symbol: response.trim(), hash: 0 }, 'belief', Truth.NEUTRAL, 0.7)];
    }
  });
}

export function createMetaReasoningGuidanceRule(lm: LMClient | null, config: Partial<LMRuleConfig> = {}): LMRule {
  return new LMRule('lm-meta-reasoning', lm, {
    ...config,
    name: 'LMMetaReasoningGuidanceRule',
    description: 'Provides meta-level reasoning guidance',
    priority: 0.75,
    promptTemplate: 'What reasoning strategy should be used for "{{primaryTerm}}"? Suggest approach.',
    taskGenerator: (response: string, primary: Term) => {
      if (!response) return [];
      return [createTask({ kind: 'atom' as const, symbol: response.trim(), hash: 0 }, 'belief', Truth.NEUTRAL, 0.65)];
    }
  });
}

export function createUncertaintyCalibrationRule(lm: LMClient | null, config: Partial<LMRuleConfig> = {}): LMRule {
  return new LMRule('lm-uncertainty-calibration', lm, {
    ...config,
    name: 'LMUncertaintyCalibrationRule',
    description: 'Calibrates confidence based on uncertainty',
    priority: 0.7,
    promptTemplate: 'Assess the uncertainty in "{{primaryTerm}}". How confident should we be?',
    taskGenerator: (response: string, primary: Term) => {
      if (!response) return [];
      return [createTask(primary, 'belief', Truth.NEUTRAL, 0.6)];
    }
  });
}

export function createSchemaInductionRule(lm: LMClient | null, config: Partial<LMRuleConfig> = {}): LMRule {
  return new LMRule('lm-schema-induction', lm, {
    ...config,
    name: 'LMSchemaInductionRule',
    description: 'Induces schemas from patterns',
    priority: 0.75,
    promptTemplate: 'What general schema or pattern can be induced from "{{primaryTerm}}"?',
    taskGenerator: (response: string, primary: Term) => {
      if (!response) return [];
      return [createTask({ kind: 'atom' as const, symbol: response.trim(), hash: 0 }, 'belief', Truth.NEUTRAL, 0.65)];
    }
  });
}

export function createTemporalCausalModelingRule(lm: LMClient | null, config: Partial<LMRuleConfig> = {}): LMRule {
  return new LMRule('lm-temporal-causal', lm, {
    ...config,
    name: 'LMTemporalCausalModelingRule',
    description: 'Models temporal and causal relationships',
    priority: 0.8,
    promptTemplate: 'What is the causal or temporal relationship in "{{primaryTerm}}"?',
    taskGenerator: (response: string, primary: Term) => {
      if (!response) return [];
      return [createTask({ kind: 'atom' as const, symbol: response.trim(), hash: 0 }, 'belief', Truth.NEUTRAL, 0.7)];
    }
  });
}

export function createVariableGroundingRule(lm: LMClient | null, config: Partial<LMRuleConfig> = {}): LMRule {
  return new LMRule('lm-variable-grounding', lm, {
    ...config,
    name: 'LMVariableGroundingRule',
    description: 'Grounds variables in concrete instances',
    priority: 0.75,
    promptTemplate: 'Ground the variables in "{{primaryTerm}}" to specific instances.',
    taskGenerator: (response: string, primary: Term) => {
      if (!response) return [];
      return [createTask({ kind: 'atom' as const, symbol: response.trim(), hash: 0 }, 'belief', Truth.NEUTRAL, 0.65)];
    }
  });
}

export function createConceptElaborationRule(lm: LMClient | null, config: Partial<LMRuleConfig> = {}): LMRule {
  return new LMRule('lm-concept-elaboration', lm, {
    ...config,
    name: 'LMConceptElaborationRule',
    description: 'Elaborates on concepts with additional details',
    priority: 0.7,
    promptTemplate: 'Elaborate on the concept "{{primaryTerm}}". Provide more details.',
    taskGenerator: (response: string, primary: Term) => {
      if (!response) return [];
      return [createTask({ kind: 'atom' as const, symbol: response.trim(), hash: 0 }, 'belief', Truth.NEUTRAL, 0.6)];
    }
  });
}

export function createInteractiveClarificationRule(lm: LMClient | null, config: Partial<LMRuleConfig> = {}): LMRule {
  return new LMRule('lm-interactive-clarification', lm, {
    ...config,
    name: 'LMInteractiveClarificationRule',
    description: 'Asks clarifying questions',
    priority: 0.65,
    promptTemplate: 'What clarification is needed for "{{primaryTerm}}"?',
    taskGenerator: (response: string, primary: Term) => {
      if (!response) return [];
      return [createTask({ kind: 'atom' as const, symbol: response.trim(), hash: 0 }, 'question', Truth.NEUTRAL, 0.5)];
    }
  });
}

export const LMRules = {
  createNarseseTranslationRule,
  createBeliefRevisionRule,
  createGoalDecompositionRule,
  createHypothesisGenerationRule,
  createExplanationGenerationRule,
  createAnalogicalReasoningRule,
  createMetaReasoningGuidanceRule,
  createUncertaintyCalibrationRule,
  createSchemaInductionRule,
  createTemporalCausalModelingRule,
  createVariableGroundingRule,
  createConceptElaborationRule,
  createInteractiveClarificationRule
};
