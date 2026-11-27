import { z } from 'zod';
import { ENGINE_ORIGINS, EngineOrigin, NAR_ORIGIN, PROPOSER_ORIGIN } from './origins';
/** Bands, most permissive first. `abstain` is below `block` rather than beside it. */
export declare const BANDS: {
    readonly act: 2;
    readonly review: 1;
    readonly block: 0;
    readonly abstain: -1;
};
export type BandDecision = keyof typeof BANDS;
export declare const BandDecisionSchema: z.ZodEnum<{
    abstain: "abstain";
    act: "act";
    block: "block";
    review: "review";
}>;
/** Whether a judgment is about what is true or what is wanted. */
export declare const COGNITIVE_AXES: readonly ['epistemic', 'teleological'];
export type CognitiveAxis = (typeof COGNITIVE_AXES)[number];
export declare const CognitiveAxisSchema: z.ZodEnum<{
    epistemic: "epistemic";
    teleological: "teleological";
}>;
/** The query shapes a judgment can take. */
export declare const JUDGMENT_SHAPES: readonly ['classify', 'evaluate', 'synthesize'];
export declare const JudgmentShapeSchema: z.ZodEnum<{
    classify: "classify";
    evaluate: "evaluate";
    synthesize: "synthesize";
}>;
/** Re-export engine origin discriminants from origins.ts to avoid duplication. */
export { ENGINE_ORIGINS, NAR_ORIGIN, PROPOSER_ORIGIN };
export type { EngineOrigin };
/** How restrictive a band is; abstaining is always the most restrictive. */
export declare const bandOrdinal: (band: BandDecision) => number;
/** Whether a judgment is about what is true or what is wanted. */
export declare const COGNITIVE_AXES_SCHEMA: z.ZodEnum<{
    epistemic: "epistemic";
    teleological: "teleological";
}>;
/** The egress gate decision schema. */
export declare const EgressVerdictSchema: z.ZodObject<{
    grounded: z.ZodBoolean;
    score: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type EgressVerdict = z.infer<typeof EgressVerdictSchema>;
/** Narrow a gate's answer to the one shape every consumer downstream expects. */
export declare const egressVerdict: (answer: boolean | EgressVerdict) => EgressVerdict;
//# sourceMappingURL=cognitive-schemas.d.ts.map