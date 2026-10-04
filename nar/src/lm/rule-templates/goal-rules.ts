/**
 * Goal-oriented LM rule definitions.
 */
import type { LMRuleDefinition } from '../rule-builders.js';
import { isComplexGoal } from '../rule-selectors/conditions.js';
import { symbolicFallbacks } from './fallbacks.js';
import { GoalDecompositionSchema } from './schemas.js';

export const goalRules: LMRuleDefinition[] = [
  {
    id: 'lm-goal-decomposition',
    prompt: 'Decompose the goal "{{primaryTerm}}" into simpler subgoals.',
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
    fallback: symbolicFallbacks['lm-goal-decomposition'],
    maxOutputTokens: 128,
  },
];
