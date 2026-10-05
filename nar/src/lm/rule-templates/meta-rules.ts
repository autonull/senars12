/**
 * V2 preset LM rule definitions (merged from rule-factory-v2.ts).
 */
import type { LMRuleDefinition } from './definition.js';
import {
  abductionFallback,
  causalFallback,
  noSymbolicEquivalent,
  similarityFallback,
} from './fallbacks.js';
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
    prompt:
      'You are a NARS hypothesis generator. Given: {{primaryTerm}}. Generate a plausible hypothesis in Narsese with truth values. Respond with JSON: {"narsese": "(...)", "truth": {"f": 0.8, "c": 0.7}, "rationale": "..."}',
    name: 'LMV2HypothesisRule',
    description: 'Generates typed hypotheses with truth values',
    priority: 0.75,
    taskType: 'belief',
    singlePremise: true,
    schema: HypothesisSchema,
    fallback: abductionFallback,
    maxOutputTokens: 256,
  },
  {
    id: 'lm-v2-explanation',
    prompt:
      'You are a NARS explanation generator. Explain why: {{primaryTerm}}. Respond with JSON: {"explanation": "...", "confidence": 0.8, "keyPremises": ["..."]}',
    name: 'LMV2ExplanationRule',
    description: 'Generates typed explanations with key premises',
    priority: 0.7,
    taskType: 'belief',
    singlePremise: true,
    schema: ExplanationSchema,
    fallback: noSymbolicEquivalent,
    maxOutputTokens: 256,
  },
  {
    id: 'lm-v2-analogy',
    prompt:
      'You are an analogical reasoning system. Source: {{primaryTerm}}. Target: {{secondaryTerm}}. Find structural analogies. Respond with JSON: {"analogies": [{"source": "...", "target": "...", "mapping": "..."}]}',
    name: 'LMV2AnalogyRule',
    description: 'Finds structural analogies between concepts',
    priority: 0.8,
    taskType: 'belief',
    schema: AnalogySchema,
    fallback: similarityFallback,
    maxOutputTokens: 256,
  },
  {
    id: 'lm-v2-causal',
    prompt:
      'You are a causal reasoning system. Analyze causal relationships for: {{primaryTerm}}. Respond with JSON: {"relations": [{"cause": "...", "effect": "...", "type": "direct|enabling|preventing", "confidence": 0.8}]}',
    name: 'LMV2CausalRule',
    description: 'Models causal relationships',
    priority: 0.8,
    taskType: 'belief',
    schema: TemporalCausalSchema,
    fallback: causalFallback,
    maxOutputTokens: 256,
  },
  {
    id: 'lm-v2-schema',
    prompt:
      'You are a schema induction system. Pattern: {{primaryTerm}}. Induce a reusable schema. Respond with JSON: {"schema": "...", "instances": ["..."], "confidence": 0.8}',
    name: 'LMV2SchemaRule',
    description: 'Induces reusable schemas from patterns',
    priority: 0.75,
    taskType: 'belief',
    singlePremise: true,
    schema: SchemaInductionSchema,
    fallback: noSymbolicEquivalent,
    maxOutputTokens: 256,
  },
];
