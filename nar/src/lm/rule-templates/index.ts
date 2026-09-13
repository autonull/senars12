/**
 * Consolidated LM rule definitions and their prompt templates.
 */
import type { LMRuleDefinition } from '../rule-builders.js';
import { beliefRules } from './belief-rules.js';
import { goalRules } from './goal-rules.js';
import { metaRules } from './meta-rules.js';
import { questionRules } from './question-rules.js';

export const ruleDefs: LMRuleDefinition[] = [
  ...beliefRules,
  ...goalRules,
  ...questionRules,
  ...metaRules,
];

export const prompts: Record<string, string> = {
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
