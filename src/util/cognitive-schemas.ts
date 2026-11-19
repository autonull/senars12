import { z } from 'zod';

/** Bands, most permissive first. `abstain` is below `block` rather than beside it. */
export const BANDS = { act: 2, review: 1, block: 0, abstain: -1 } as const;
export type BandDecision = keyof typeof BANDS;
export const BandDecisionSchema = z.enum(Object.keys(BANDS) as [BandDecision, ...BandDecision[]]);

/** Whether a judgment is about what is true or what is wanted. */
export const COGNITIVE_AXES = ['epistemic', 'teleological'] as const;
export type CognitiveAxis = (typeof COGNITIVE_AXES)[number];
export const CognitiveAxisSchema = z.enum(COGNITIVE_AXES);

/** The query shapes a judgment can take. */
export const JUDGMENT_SHAPES = ['classify', 'evaluate', 'synthesize'] as const;
export const JudgmentShapeSchema = z.enum(JUDGMENT_SHAPES);

/** The one origin permitted to append proposal events. */
export const PROPOSER_ORIGIN = 'proposer' as const;

/** The origin the reasoning engine appends under. */
export const NAR_ORIGIN = 'nar' as const;

/** Engine origin discriminants. */
export const ENGINE_ORIGINS = ['nar', 'kernel', 'proposer', 'metta'] as const;
export type EngineOrigin = (typeof ENGINE_ORIGINS)[number];

/** How restrictive a band is; abstaining is always the most restrictive. */
export const bandOrdinal = (band: BandDecision): number => BANDS[band];

/** Whether a judgment is about what is true or what is wanted. */
export const COGNITIVE_AXES_SCHEMA = CognitiveAxisSchema;

/** The egress gate decision schema. */
export const EgressVerdictSchema = z.object({
  grounded: z.boolean(),
  score: z.number().optional(),
});

export type EgressVerdict = z.infer<typeof EgressVerdictSchema>;

/** Narrow a gate's answer to the one shape every consumer downstream expects. */
export const egressVerdict = (answer: boolean | EgressVerdict): EgressVerdict =>
  typeof answer === 'boolean' ? { grounded: answer } : answer;