/**
 * JudgmentPipeline — composes over HEAD_SPECS (ordered heads + bands + calibrators + router + cascade).
 * Versioned pipeline ModelDigest for auditability.
 * HEAD_SPECS already declarative; pipeline adds composition + digest, does not replace the table.
 */
import type { HeadResult } from '../../decision/types';
import { type HeadFactoryOptions, type HeadGroup, type HeadId, type JudgmentQuery } from './head-specs';
import { type BandDecision } from './policy';
export interface PipelineStage {
    readonly group: HeadGroup;
    readonly heads: readonly HeadId[];
    readonly router?: 'confidence' | 'cascade' | 'consensus';
    readonly cascadeThreshold?: number;
}
export interface BandConfig {
    readonly threshold: number;
    readonly action: BandDecision;
}
export interface CalibratorConfig {
    readonly version: string;
    readonly abstainThreshold: number;
}
export interface PipelineRouterConfig {
    readonly type: 'confidence' | 'cascade' | 'consensus';
    readonly bands: readonly BandConfig[];
    readonly cascadeThreshold?: number;
}
export interface PipelineSpec {
    readonly id: string;
    readonly version: string;
    readonly stages: readonly PipelineStage[];
    readonly router: PipelineRouterConfig;
    readonly calibrators: Partial<Record<HeadId, CalibratorConfig>>;
    readonly headFactoryOptions: HeadFactoryOptions;
}
export interface PipelineModelDigest {
    readonly encoderDigest: string;
    readonly headWeightsDigest: string;
    readonly specHash: string;
    readonly createdAt: number;
}
/** A head's verdict with the routing context the pipeline adds. One shape: the pipeline
 * annotated a re-declared copy of `HeadResult` with `any`, which is how its abstain
 * reason drifted to `string` and grew a value the rubric union had never heard of. */
export type PipelineHeadResult = Readonly<Required<Pick<HeadResult, 'rubric' | 'axis'>> & HeadResult>;
export interface JudgmentPipelineResult {
    readonly propositions: PipelineHeadResult[];
    readonly modelDigest: PipelineModelDigest;
    readonly stageResults: Map<HeadGroup, PipelineHeadResult[]>;
}
/** One stage per head group, in ontology order. The stage heads were a hand-written
 *  list of every rubric beside the table that already groups them, so a head added to
 *  a group joined the ontology and not the pipeline. */
export declare const DEFAULT_PIPELINE_STAGES: readonly PipelineStage[];
/** Default bands for router. The two graded rungs are the confidence router's own
 *  thresholds; below `review` this pipeline abstains rather than blocking, which is
 *  its own policy and the reason it keeps a rung of its own. */
export declare const DEFAULT_PIPELINE_BANDS: readonly BandConfig[];
export declare class JudgmentPipeline {
    private readonly spec;
    private readonly heads;
    private readonly modelDigest;
    constructor(spec?: Partial<PipelineSpec>);
    /** Run the full pipeline on an embedding and query context. */
    judge(embedding: Float32Array, queries: JudgmentQuery[]): Promise<JudgmentPipelineResult>;
    private judgeStage;
    private toResult;
    private applyRouter;
    private computeModelDigest;
    getSpec(): PipelineSpec;
    getModelDigest(): PipelineModelDigest;
    verifyDigest(digest: PipelineModelDigest): boolean;
}
export declare function createJudgmentPipeline(overrides?: Partial<PipelineSpec>): JudgmentPipeline;
//# sourceMappingURL=judgment-pipeline.d.ts.map