/**
 * Question-oriented LM rule definitions (curiosity-driven).
 */
import type { LMRuleDefinition } from '../rule-builders.js';
import { hasHighCuriosity } from '../rule-selectors/confidence.js';
import { symbolicFallbacks } from './fallbacks.js';
import { QuestionGenerationSchema } from './schemas.js';

export const questionRules: LMRuleDefinition[] = [
  {
    id: 'lm-curiosity-question',
    prompt: 'Given "{{primaryTerm}}" and curiosity drive, what questions should be asked? Generate Narsese questions. Respond with JSON: {"questions": [{"narsese": "?term", "relevance": 0.8, "rationale": "..."}]}',
    name: 'LMCuriosityQuestionRule',
    description: 'Generates questions driven by curiosity',
    priority: 0.7,
    taskType: 'question',
    budget: 0.65,
    singlePremise: true,
    activationCondition: hasHighCuriosity,
    schema: QuestionGenerationSchema,
    fallback: symbolicFallbacks['lm-curiosity-question'],
    maxOutputTokens: 256,
  },
  {
    id: 'lm-interactive-clarification',
    prompt: 'What clarification is needed for "{{primaryTerm}}"?',
    name: 'LMInteractiveClarificationRule',
    description: 'Seeks clarification for ambiguous inputs',
    priority: 0.7,
    taskType: 'question',
    budget: 0.65,
    fallback: symbolicFallbacks['lm-interactive-clarification'],
    maxOutputTokens: 64,
  },
];
