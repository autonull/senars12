/**
 * Formalization candidate schemas — an LM returns multiple candidates with
 * ambiguity flags and the kernel admits them provisionally. No single
 * authoritative parse; the kernel validates each candidate.
 */

import { parseOrThrow } from '@senars/util';
import { z } from 'zod';
import { TruthValueSchema } from './truth.js';

export const AmbiguityFlagSchema = z.object({
  type: z.enum([
    'parse',
    'intent',
    'term',
    'reference',
    'quantifier',
    'modal',
    'temporal',
    'negation',
  ]),
  description: z.string(),
  options: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  severity: z.enum(['low', 'medium', 'high']),
});

export const SourceSpanSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  text: z.string(),
});

export const FormalizationCandidateSchema = z.object({
  candidateId: z.string().uuid(),
  narsese: z.string(),
  taskType: z.enum(['belief', 'goal', 'question']),
  truth: TruthValueSchema.optional(),
  confidence: z.number().min(0).max(1), // LLM's confidence in this parse
  sourceSpans: z.array(SourceSpanSchema),
  ambiguityFlags: z.array(AmbiguityFlagSchema),
  metadata: z
    .object({
      model: z.string().optional(),
      promptTokens: z.number().int().nonnegative().optional(),
      completionTokens: z.number().int().nonnegative().optional(),
      latencyMs: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export const FormalizationBatchSchema = z.object({
  batchId: z.string().uuid(),
  sourceText: z.string(),
  candidates: z.array(FormalizationCandidateSchema),
  detectedIntent: z.enum(['chat', 'command', 'reasoning', 'learning']).optional(),
  globalAmbiguities: z.array(AmbiguityFlagSchema).optional(),
});

export type FormalizationCandidate = z.infer<typeof FormalizationCandidateSchema>;
export type AmbiguityFlag = z.infer<typeof AmbiguityFlagSchema>;
export type SourceSpan = z.infer<typeof SourceSpanSchema>;
export type FormalizationBatch = z.infer<typeof FormalizationBatchSchema>;

export const validateFormalizationCandidate = (candidate: unknown): FormalizationCandidate =>
  parseOrThrow(FormalizationCandidateSchema, 'FormalizationCandidate', candidate);

export const validateFormalizationBatch = (batch: unknown): FormalizationBatch =>
  parseOrThrow(FormalizationBatchSchema, 'FormalizationBatch', batch);
