import { z } from 'zod';
import { ENGINE_ORIGINS, NAR_ORIGIN, PROPOSER_ORIGIN } from './origins';
/** Bands, most permissive first. `abstain` is below `block` rather than beside it. */
export const BANDS = { act: 2, review: 1, block: 0, abstain: -1 };
export const BandDecisionSchema = z.enum(Object.keys(BANDS));
/** Whether a judgment is about what is true or what is wanted. */
export const COGNITIVE_AXES = ['epistemic', 'teleological'];
export const CognitiveAxisSchema = z.enum(COGNITIVE_AXES);
/** The query shapes a judgment can take. */
export const JUDGMENT_SHAPES = ['classify', 'evaluate', 'synthesize'];
export const JudgmentShapeSchema = z.enum(JUDGMENT_SHAPES);
/** Re-export engine origin discriminants from origins.ts to avoid duplication. */
export { ENGINE_ORIGINS, NAR_ORIGIN, PROPOSER_ORIGIN };
/** How restrictive a band is; abstaining is always the most restrictive. */
export const bandOrdinal = (band) => BANDS[band];
/** Whether a judgment is about what is true or what is wanted. */
export const COGNITIVE_AXES_SCHEMA = CognitiveAxisSchema;
/** The egress gate decision schema. */
export const EgressVerdictSchema = z.object({
    grounded: z.boolean(),
    score: z.number().optional(),
});
/** Narrow a gate's answer to the one shape every consumer downstream expects. */
export const egressVerdict = (answer) => typeof answer === 'boolean' ? { grounded: answer } : answer;
