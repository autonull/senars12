/**
 * V2 preset LM rule definitions (merged from rule-factory-v2.ts).
 */
import type { LMRuleDefinition } from '../rule-builders.js';
import { symbolicFallbacks } from './fallbacks.js';
import {
  AnalogySchema,
  ExplanationSchema,
  HypothesisSchema,
  SchemaInductionSchema,
  TemporalCausalSchema,
} from './schemas.js';

export const metaRules: LMRuleDefinition[] = [
  {
    id: 'lm-v2-hypothesis',
    name: 'LMV2HypothesisRule',
    description: 'Generates typed hypotheses with truth values',
    priority: 0.75,
    taskType: 'belief',
    singlePremise: true,
    schema: HypothesisSchema,
    fallback: symbolicFallbacks['lm-v2-hypothesis'],
    maxOutputTokens: 256,
  },
  {
    id: 'lm-v2-explanation',
    name: 'LMV2ExplanationRule',
    description: 'Generates typed explanations with key premises',
    priority: 0.7,
    taskType: 'belief',
    singlePremise: true,
    schema: ExplanationSchema,
    fallback: symbolicFallbacks['lm-v2-explanation'],
    maxOutputTokens: 256,
  },
  {
    id: 'lm-v2-analogy',
    name: 'LMV2AnalogyRule',
    description: 'Finds structural analogies between concepts',
    priority: 0.8,
    taskType: 'belief',
    schema: AnalogySchema,
    fallback: symbolicFallbacks['lm-v2-analogy'],
    maxOutputTokens: 256,
  },
  {
    id: 'lm-v2-causal',
    name: 'LMV2CausalRule',
    description: 'Models causal relationships',
    priority: 0.8,
    taskType: 'belief',
    schema: TemporalCausalSchema,
    fallback: symbolicFallbacks['lm-v2-causal'],
    maxOutputTokens: 256,
  },
  {
    id: 'lm-v2-schema',
    name: 'LMV2SchemaRule',
    description: 'Induces reusable schemas from patterns',
    priority: 0.75,
    taskType: 'belief',
    singlePremise: true,
    schema: SchemaInductionSchema,
    fallback: symbolicFallbacks['lm-v2-schema'],
    maxOutputTokens: 256,
  },
];
