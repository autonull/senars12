/**
 * Question-oriented LM rule definitions (curiosity-driven).
 */
import type { LMRuleDefinition } from '../rule-builders.js';
import { hasHighCuriosity } from '../rule-selectors/confidence.js';
import { QuestionGenerationSchema } from '../../nl';

export const questionRules: LMRuleDefinition[] = [
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
];
