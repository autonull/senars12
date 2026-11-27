/**
 * Sandboxed inference head for System One.
 * Trained weights behind a digest-pinned runtime with feature caching.
 */
import type { HeadArtifactConfig, HeadArtifactBundle, JudgmentHead, JudgmentQuery, RubricId, CognitiveAxis } from './types';
export type { JudgmentHead };
/**
 * Inference head: scores (embedding, action, game?) → [0, 1] value.
 * Weights are frozen at construction; config is validated via HeadArtifactConfigSchema.
 */
export declare class TrainedLinearHead implements JudgmentHead {
    #private;
    readonly rubric: RubricId;
    readonly axis: CognitiveAxis;
    readonly fitted: true;
    readonly modelDigest: string;
    constructor(config: HeadArtifactConfig, weightsBytes: Buffer, modelDigest: string);
    static fromBundle(bundle: HeadArtifactBundle): TrainedLinearHead;
    score(embedding: Float32Array, action: string, game?: string): number;
    evaluate(embedding: Float32Array, query: JudgmentQuery): Promise<{
        score: number;
        abstained: boolean;
    }>;
}
//# sourceMappingURL=trained-head.d.ts.map