/**
 * Formalization candidate schemas — an LM returns multiple candidates with
 * ambiguity flags and the kernel admits them provisionally. No single
 * authoritative parse; the kernel validates each candidate.
 */

import { parseOrThrow } from '@senars/util';
import { z } from 'zod';
import { TaskTypeSchema } from './task.js';
import { TruthValueSchema } from './truth.js';

/** What can be ambiguous about a parse. The LM's ambiguity schema and the kernel's
 *  flag schema named four of these eight, so four kinds of real ambiguity were
 *  unreportable through the NL path. */
export const AMBIGUITY_TYPES = [
  'parse',
  'intent',
  'term',
  'reference',
  'quantifier',
  'modal',
  'temporal',
  'negation',
] as const;

export type AmbiguityType = (typeof AMBIGUITY_TYPES)[number];

export const AMBIGUITY_SEVERITIES = ['low', 'medium', 'high'] as const;

export type AmbiguitySeverity = (typeof AMBIGUITY_SEVERITIES)[number];

/**
 * How much an ambiguity of each kind should cost the parse that carries it.
 *
 * A judgement about the *kind*, owned here rather than asked of the proposer: the
 * NL path used to declare an ambiguity without a severity and the conversion to a
 * formalization batch supplied `'medium'` for whatever the model had reported, so a
 * negation-scoped claim the detector rates `high` arrived as `medium` and a `low`
 * one was inflated to match. `satisfies Record<AmbiguityType, ...>` makes a new kind
 * a compile error here until its cost is decided, and {@link detectAmbiguityFlags}
 * reads the same table, so the two producers cannot disagree.
 */
export const AMBIGUITY_SEVERITY = {
  parse: 'high',
  intent: 'high',
  term: 'medium',
  reference: 'low',
  quantifier: 'medium',
  modal: 'medium',
  temporal: 'low',
  negation: 'high',
} as const satisfies Record<AmbiguityType, AmbiguitySeverity>;

/** The severity an ambiguity of this kind carries. */
export const ambiguitySeverityOf = (type: AmbiguityType): AmbiguitySeverity =>
  AMBIGUITY_SEVERITY[type];

/** The flag as a proposer reports it: *what* is ambiguous, not how much it costs. */
export const AmbiguityReportSchema = z.object({
  type: z.enum(AMBIGUITY_TYPES),
  description: z.string(),
  options: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type AmbiguityReport = z.infer<typeof AmbiguityReportSchema>;

/** The flag as the kernel weighs it — the report plus the severity its kind carries. */
export const AmbiguityFlagSchema = AmbiguityReportSchema.extend({
  severity: z.enum(AMBIGUITY_SEVERITIES),
});

export const SourceSpanSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  text: z.string(),
});

export const FormalizationCandidateSchema = z.object({
  candidateId: z.string().uuid(),
  narsese: z.string(),
  taskType: TaskTypeSchema,
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
