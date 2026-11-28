/**
 * Head artifact serialization for System One.
 * On-disk format: config.json + weights.bin + MODEL_DIGEST
 */
import { z } from 'zod';
import type { TrainedHeadModel, HeadArtifactBundle } from './types';
/**
 * The on-disk half of the head contract, validated at the edge it crosses.
 *
 * `config.json` was read with `JSON.parse(raw) as HeadArtifactConfig`, so a
 * truncated write, a hand-edited field or a bundle from an older geometry produced
 * a head that scored `NaN` on every candidate and never said so. This is the same
 * treatment the rest of the kernel gives an untrusted payload, and it is also what
 * lets the loader drop the two `as RubricId` / `as CognitiveAxis` casts: the schema
 * is typed on the *same* vocabulary the geometry is, so a config naming a rubric
 * that no head has cannot parse.
 */
/** `satisfies z.ZodType<HeadArtifactConfig>` makes the schema and the interface one
 *  declaration: a field added to either without the other is a compile error, not a
 *  config that parses one way and types the other. */
export declare const HeadArtifactConfigSchema: z.ZodObject<{
    headId: z.ZodString;
    rubric: z.ZodEnum<{
        ambiguity: "ambiguity";
        assertion: "assertion";
        candidate_select: "candidate_select";
        conflict: "conflict";
        episodic_match: "episodic_match";
        feasibility: "feasibility";
        groundedness: "groundedness";
        illocution: "illocution";
        injection: "injection";
        novelty: "novelty";
        plausibility: "plausibility";
        reflex_value: "reflex_value";
        relevance: "relevance";
        risk: "risk";
        source_quality: "source_quality";
        strategy: "strategy";
        task_type: "task_type";
        tense: "tense";
        tool_dispatch: "tool_dispatch";
    }>;
    axis: z.ZodEnum<{
        epistemic: "epistemic";
        teleological: "teleological";
    }>;
    kind: z.ZodEnum<{
        linear: "linear";
        logistic: "logistic";
    }>;
    embeddingDim: z.ZodNumber;
    actionFeatureDim: z.ZodNumber;
    gameFeatureDim: z.ZodNumber;
    encoder: z.ZodObject<{
        modelId: z.ZodString;
        dimension: z.ZodNumber;
    }, z.core.$strip>;
    metrics: z.ZodObject<{
        samples: z.ZodNumber;
        epochs: z.ZodNumber;
        trainLoss: z.ZodNumber;
        holdoutLoss: z.ZodNumber;
        valueCorrelation: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
    mean: z.ZodArray<z.ZodNumber>;
    std: z.ZodArray<z.ZodNumber>;
    encoderDigest: z.ZodString;
    weightsDigest: z.ZodString;
    modelDigest: z.ZodString;
}, z.core.$strict>;
/** Serialize a trained model to the on-disk artifact bundle. */
export declare function exportArtifacts(model: TrainedHeadModel): HeadArtifactBundle;
/** Write a trained model's artifacts to disk. */
export declare function writeHeadArtifacts(model: TrainedHeadModel, outDir: string): Promise<HeadArtifactBundle>;
/** Load a trained head bundle, verifying the config, the weights hash and the pinned digest. */
export declare function loadHeadArtifacts(outDir: string, pinnedDigest?: string): Promise<import('./trained-head').TrainedLinearHead>;
//# sourceMappingURL=head-artifacts.d.ts.map