import { isComplexGoal } from '../rule-selectors/conditions';
import { conjunctionDecomposition } from './fallbacks';
import { GoalDecompositionSchema } from './schemas';
export const goalRules = [
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
        fallback: conjunctionDecomposition,
        maxOutputTokens: 128,
    },
];
