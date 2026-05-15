import {z} from 'zod';

export const NarseseBeliefSchema = z.object({
    narsese: z.string().describe('A single valid Narsese statement, e.g. (bird --> animal).'),
    truth: z.object({
        f: z.number().min(0).max(1).describe('Frequency'),
        c: z.number().min(0).max(1).describe('Confidence'),
    }).optional(),
});

export const TranslationSchema = z.object({
    beliefs: z.array(NarseseBeliefSchema).describe('Narsese beliefs extracted from the input'),
    isQuestion: z.boolean().describe('Whether the input is a question'),
    summary: z.string().describe('Brief natural language summary'),
});

export const ExplanationSchema = z.object({
    explanation: z.string(),
    relatedConcepts: z.array(z.string()).optional(),
    confidence: z.number().min(0).max(1).optional(),
});

export const GoalDecompositionSchema = z.object({
    subgoals: z.array(z.string()),
});

export const HypothesisSchema = z.object({
    hypotheses: z.array(z.object({
        narsese: z.string(),
        confidence: z.number().min(0).max(1),
    })),
});

export const AnalogySchema = z.object({
    analogies: z.array(z.object({
        source: z.string(),
        target: z.string(),
        mapping: z.string(),
    })),
});

export const MetaReasoningSchema = z.object({
    analysis: z.string(),
    suggestion: z.string(),
});

export const UncertaintySchema = z.object({
    recommendedConfidence: z.number().min(0).max(1),
});

export const SchemaInductionSchema = z.object({
    schema: z.string(),
    examples: z.array(z.string()),
});

export const TemporalCausalSchema = z.object({
    relations: z.array(z.object({
        cause: z.string(),
        effect: z.string(),
        type: z.string(),
    })),
});

export const VariableGroundingSchema = z.object({
    instances: z.array(z.string()),
});

export const ConceptElaborationSchema = z.object({
    properties: z.array(z.string()),
    relations: z.array(z.string()),
});

export const ClarificationSchema = z.object({
    question: z.string(),
    options: z.array(z.string()),
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
