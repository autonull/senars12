/**
 * Zod schemas for LM rule definitions (REFACTOR.todo4 Phase B).
 * Moved from nl/schemas.ts to break the rule-builders → rule-templates → nl → nar cycle.
 */
import { AmbiguityReportSchema, DetectedIntentSchema } from '@senars/core/schemas';
import { z } from 'zod';
import { unitInterval } from '@senars/util/config';

export const NarseseBeliefSchema = z.object({
  narsese: z.string().describe('A single valid Narsese statement, e.g. (bird --> animal).'),
  truth: z
    .object({
      f: unitInterval.describe('Frequency'),
      c: unitInterval.describe('Confidence'),
    })
    .optional(),
});

export const TranslationSchema = z.object({
  beliefs: z.array(NarseseBeliefSchema).describe('Narsese beliefs to assert'),
  questions: z.array(z.string()).describe('Narsese questions to ask (raw Narsese strings)'),
  goals: z.array(z.string()).describe('Narsese goals to pursue (raw Narsese strings)'),
  summary: z.string().describe('Brief natural language summary of what was extracted'),
});

export const ExplanationSchema = z.object({
  explanation: z.string(),
  relatedConcepts: z.array(z.string()).optional(),
  confidence: unitInterval.optional(),
});

export const GoalDecompositionSchema = z.object({
  subgoals: z.array(z.string()),
});

export const HypothesisSchema = z.object({
  hypotheses: z.array(
    z.object({
      narsese: z.string(),
      confidence: unitInterval,
    })
  ),
});

export const AnalogySchema = z.object({
  analogies: z.array(
    z.object({
      source: z.string(),
      target: z.string(),
      mapping: z.string(),
    })
  ),
});

export const MetaReasoningSchema = z.object({
  analysis: z.string(),
  suggestion: z.string(),
});

export const UncertaintySchema = z.object({
  recommendedConfidence: unitInterval,
});

export const SchemaInductionSchema = z.object({
  schema: z.string(),
  examples: z.array(z.string()),
});

export const TemporalCausalSchema = z.object({
  relations: z.array(
    z.object({
      cause: z.string(),
      effect: z.string(),
      type: z.string(),
    })
  ),
});

export const VariableGroundingSchema = z.object({
  instances: z.array(z.string()),
});

export const ConceptElaborationSchema = z.object({
  properties: z.array(z.string()),
  relations: z.array(z.string()),
});

export const BeliefRevisionSchema = z.object({
  revised: z.object({
    narsese: z.string().describe('Revised Narsese statement'),
    truth: z.object({
      f: unitInterval.describe('Revised frequency'),
      c: unitInterval.describe('Revised confidence'),
    }),
  }),
  reason: z.string().describe('Explanation for the revision'),
});

export const QuestionGenerationSchema = z.object({
  questions: z.array(
    z.object({
      narsese: z.string().describe('Narsese question ending in ?'),
      relevance: unitInterval.describe('How relevant to current context'),
      rationale: z.string().describe('Why this question is worth asking'),
    })
  ),
});

export const ClarificationSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
});

/** What an LM may report as ambiguous — the kernel's kinds, without a severity.
 *  A four-kind restatement here is what made quantifier/modal/temporal/negation
 *  ambiguity unreportable through the NL path. */
export const AmbiguitySchema = AmbiguityReportSchema;

export const CoreferenceSchema = z.object({
  pronoun: z.string(),
  antecedent: z.string(),
  confidence: unitInterval,
});

export const TaskBatchSchema = z.object({
  beliefs: z.array(
    z.object({
      narsese: z.string().describe('A single valid Narsese statement'),
      truth: z
        .object({
          f: unitInterval.describe('Frequency'),
          c: unitInterval.describe('Confidence'),
        })
        .optional(),
      source: z.enum(['user', 'inferred']).describe('Source of the belief'),
      sourceText: z.string().optional().describe('Verbatim input substring this item came from'),
    })
  ),
  questions: z.array(
    z.object({
      narsese: z.string().describe('Narsese question string ending in ?'),
      context: z.string().optional(),
      sourceText: z.string().optional().describe('Verbatim input substring this item came from'),
    })
  ),
  goals: z.array(
    z.object({
      narsese: z.string().describe('Narsese goal string ending in !'),
      priority: unitInterval.optional(),
      sourceText: z.string().optional().describe('Verbatim input substring this item came from'),
    })
  ),
  meta: z.object({
    detectedIntent: DetectedIntentSchema,
    ambiguities: z.array(AmbiguitySchema),
    coreferences: z.array(CoreferenceSchema),
    implicitContext: z.array(z.string()),
    driveModulations: z
      .record(z.string(), z.number())
      .optional()
      .describe('Drive modulation adjustments (driveId -> amount)'),
  }),
});

export const GenerationOutputSchema = z.object({
  response: z.string().describe('Natural language response'),
  confidence: unitInterval.describe('Confidence in the response'),
  suggestedFollowups: z.array(z.string()).describe('Suggested follow-up questions'),
  meta: z.object({
    reasoningType: z.string().describe('Type of reasoning used'),
    keyPremises: z.array(z.string()).describe('Key premises in the reasoning'),
    gaps: z.array(z.string()).describe('Knowledge gaps identified'),
  }),
});

export type TranslationResult = z.infer<typeof TranslationSchema>;
export type ExplanationResult = z.infer<typeof ExplanationSchema>;
export type GoalDecompositionResult = z.infer<typeof GoalDecompositionSchema>;
export type HypothesisResult = z.infer<typeof HypothesisSchema>;
export type AnalogyResult = z.infer<typeof AnalogySchema>;
export type MetaReasoningResult = z.infer<typeof MetaReasoningSchema>;
export type UncertaintyResult = z.infer<typeof UncertaintySchema>;
export type SchemaInductionResult = z.infer<typeof SchemaInductionSchema>;
export type TemporalCausalResult = z.infer<typeof TemporalCausalSchema>;
export type VariableGroundingResult = z.infer<typeof VariableGroundingSchema>;
export type ConceptElaborationResult = z.infer<typeof ConceptElaborationSchema>;
export type ClarificationResult = z.infer<typeof ClarificationSchema>;
export type BeliefRevisionResult = z.infer<typeof BeliefRevisionSchema>;
export type QuestionGenerationResult = z.infer<typeof QuestionGenerationSchema>;
