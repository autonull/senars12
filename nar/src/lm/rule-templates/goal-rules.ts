import { GoalDecompositionSchema } from '../../nl';
/**
 * Goal-oriented LM rule definitions.
 */
import type { LMRuleDefinition } from '../rule-builders.js';
import { isComplexGoal } from '../rule-selectors/factory.js';

export const goalRules: LMRuleDefinition[] = [
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
];
