import { z } from 'zod';
export declare const NarseseBeliefSchema: z.ZodObject<{
    narsese: z.ZodString;
    truth: z.ZodOptional<z.ZodObject<{
        f: z.ZodNumber;
        c: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const TranslationSchema: z.ZodObject<{
    beliefs: z.ZodArray<z.ZodObject<{
        narsese: z.ZodString;
        truth: z.ZodOptional<z.ZodObject<{
            f: z.ZodNumber;
            c: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    questions: z.ZodArray<z.ZodString>;
    goals: z.ZodArray<z.ZodString>;
    summary: z.ZodString;
}, z.core.$strip>;
export declare const ExplanationSchema: z.ZodObject<{
    explanation: z.ZodString;
    relatedConcepts: z.ZodOptional<z.ZodArray<z.ZodString>>;
    confidence: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const GoalDecompositionSchema: z.ZodObject<{
    subgoals: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare const HypothesisSchema: z.ZodObject<{
    hypotheses: z.ZodArray<z.ZodObject<{
        narsese: z.ZodString;
        confidence: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const AnalogySchema: z.ZodObject<{
    analogies: z.ZodArray<z.ZodObject<{
        source: z.ZodString;
        target: z.ZodString;
        mapping: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const MetaReasoningSchema: z.ZodObject<{
    analysis: z.ZodString;
    suggestion: z.ZodString;
}, z.core.$strip>;
export declare const UncertaintySchema: z.ZodObject<{
    recommendedConfidence: z.ZodNumber;
}, z.core.$strip>;
export declare const SchemaInductionSchema: z.ZodObject<{
    schema: z.ZodString;
    examples: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare const TemporalCausalSchema: z.ZodObject<{
    relations: z.ZodArray<z.ZodObject<{
        cause: z.ZodString;
        effect: z.ZodString;
        type: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const VariableGroundingSchema: z.ZodObject<{
    instances: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare const ConceptElaborationSchema: z.ZodObject<{
    properties: z.ZodArray<z.ZodString>;
    relations: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare const BeliefRevisionSchema: z.ZodObject<{
    revised: z.ZodObject<{
        narsese: z.ZodString;
        truth: z.ZodObject<{
            f: z.ZodNumber;
            c: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>;
    reason: z.ZodString;
}, z.core.$strip>;
export declare const QuestionGenerationSchema: z.ZodObject<{
    questions: z.ZodArray<z.ZodObject<{
        narsese: z.ZodString;
        relevance: z.ZodNumber;
        rationale: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const ClarificationSchema: z.ZodObject<{
    question: z.ZodString;
    options: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
/** What an LM may report as ambiguous — the kernel's kinds, without a severity.
 *  A four-kind restatement here is what made quantifier/modal/temporal/negation
 *  ambiguity unreportable through the NL path. */
export declare const AmbiguitySchema: z.ZodObject<{
    type: z.ZodEnum<{
        intent: "intent";
        modal: "modal";
        negation: "negation";
        parse: "parse";
        quantifier: "quantifier";
        reference: "reference";
        temporal: "temporal";
        term: "term";
    }>;
    description: z.ZodString;
    options: z.ZodArray<z.ZodString>;
    confidence: z.ZodNumber;
}, z.core.$strip>;
export declare const CoreferenceSchema: z.ZodObject<{
    pronoun: z.ZodString;
    antecedent: z.ZodString;
    confidence: z.ZodNumber;
}, z.core.$strip>;
export declare const TaskBatchSchema: z.ZodObject<{
    beliefs: z.ZodArray<z.ZodObject<{
        narsese: z.ZodString;
        truth: z.ZodOptional<z.ZodObject<{
            f: z.ZodNumber;
            c: z.ZodNumber;
        }, z.core.$strip>>;
        source: z.ZodEnum<{
            inferred: "inferred";
            user: "user";
        }>;
        sourceText: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    questions: z.ZodArray<z.ZodObject<{
        narsese: z.ZodString;
        context: z.ZodOptional<z.ZodString>;
        sourceText: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    goals: z.ZodArray<z.ZodObject<{
        narsese: z.ZodString;
        priority: z.ZodOptional<z.ZodNumber>;
        sourceText: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    meta: z.ZodObject<{
        detectedIntent: z.ZodEnum<{
            chat: "chat";
            command: "command";
            learning: "learning";
            reasoning: "reasoning";
        }>;
        ambiguities: z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<{
                intent: "intent";
                modal: "modal";
                negation: "negation";
                parse: "parse";
                quantifier: "quantifier";
                reference: "reference";
                temporal: "temporal";
                term: "term";
            }>;
            description: z.ZodString;
            options: z.ZodArray<z.ZodString>;
            confidence: z.ZodNumber;
        }, z.core.$strip>>;
        coreferences: z.ZodArray<z.ZodObject<{
            pronoun: z.ZodString;
            antecedent: z.ZodString;
            confidence: z.ZodNumber;
        }, z.core.$strip>>;
        implicitContext: z.ZodArray<z.ZodString>;
        driveModulations: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const GenerationOutputSchema: z.ZodObject<{
    response: z.ZodString;
    confidence: z.ZodNumber;
    suggestedFollowups: z.ZodArray<z.ZodString>;
    meta: z.ZodObject<{
        reasoningType: z.ZodString;
        keyPremises: z.ZodArray<z.ZodString>;
        gaps: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
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
//# sourceMappingURL=schemas.d.ts.map