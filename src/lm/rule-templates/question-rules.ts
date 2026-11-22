/**
 * Question-oriented LM rule definitions (curiosity-driven).
 */
import type { LMRuleDefinition } from './definition';
import { hasHighCuriosity } from '../rule-selectors/confidence';
import { clarificationFallback, curiosityQuestionFallback } from './fallbacks';
import { QuestionGenerationSchema } from './schemas';

export const questionRules: LMRuleDefinition[] = [
  {
    id: 'lm-curiosity-question',
    prompt:
      'Given "{{primaryTerm}}" and curiosity drive, what questions should be asked? Generate Narsese questions. Respond with JSON: {"questions": [{"narsese": "?term", "relevance": 0.8, "rationale": "..."}]}',
    name: 'LMCuriosityQuestionRule',
    description: 'Generates questions driven by curiosity',
    priority: 0.7,
    taskType: 'question',
    budget: 0.65,
    singlePremise: true,
    activationCondition: hasHighCuriosity,
    schema: QuestionGenerationSchema,
    fallback: curiosityQuestionFallback,
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
    fallback: clarificationFallback,
    maxOutputTokens: 64,
  },
];
