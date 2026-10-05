/**
 * Formalization candidate schemas — an LM returns multiple candidates with
 * ambiguity flags and the kernel admits them provisionally. No single
 * authoritative parse; the kernel validates each candidate.
 */

import { type CapabilityRisk, parseOrThrow } from '@senars/util';
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

/**
 * The severity ladder an ambiguity is costed on. Deliberately a different
 * domain from `CAPABILITY_RISKS` and only *spelled* the same — how much a parse
 * pays for an ambiguity is not how much an act may proceed unattended — so the
 * ladder is declared here and ratcheted against that one rather than aliased to
 * it. If the tiers ever need to diverge, this is the line to break.
 */
export const AMBIGUITY_SEVERITIES = [
  'low',
  'medium',
  'high',
] as const satisfies readonly CapabilityRisk[];

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

/** What the translator decided an utterance was *for*. The rule-template generator
 *  wrote its own copy of this four-member union, so an intent the batch admits was
 *  one the generator could not declare — and the two were free to drift. */
export const DETECTED_INTENTS = ['chat', 'command', 'reasoning', 'learning'] as const;

export type DetectedIntent = (typeof DETECTED_INTENTS)[number];

export const DetectedIntentSchema = z.enum(DETECTED_INTENTS);

export const FormalizationBatchSchema = z.object({
  batchId: z.string().uuid(),
  sourceText: z.string(),
  candidates: z.array(FormalizationCandidateSchema),
  detectedIntent: DetectedIntentSchema.optional(),
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
