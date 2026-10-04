/**
 * JudgmentPipeline — composes over HEAD_SPECS (ordered heads + bands + calibrators + router + cascade).
 * Versioned pipeline ModelDigest for auditability.
 * HEAD_SPECS already declarative; pipeline adds composition + digest, does not replace the table.
 */

import { shortSha256Hex } from '@senars/util';
import type { HeadResult } from '../../decision/types.js';
import { HEAD_SPECS, headSpecsInGroup } from './head-ontology.js';
import {
  type CalibrationVersion,
  createHead,
  type EmbeddingCache,
  type HeadFactoryOptions,
  type HeadGroup,
  type HeadId,
  type JudgmentQuery,
} from './head-specs.js';
import { type BandDecision, DEFAULT_CONFIDENCE_BANDS } from './policy.js';

export interface PipelineStage {
  readonly group: HeadGroup;
  readonly heads: readonly HeadId[];
  readonly router?: 'confidence' | 'cascade' | 'consensus';
  readonly cascadeThreshold?: number;
}

export interface BandConfig {
  readonly name: string;
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
export type PipelineHeadResult = Readonly<
  Required<Pick<HeadResult, 'rubric' | 'axis'>> & HeadResult
>;

export interface JudgmentPipelineResult {
  readonly propositions: PipelineHeadResult[];
  readonly modelDigest: PipelineModelDigest;
  readonly stageResults: Map<HeadGroup, PipelineHeadResult[]>;
}

/** Scores below this in a cascade stage abstain instead of being judged. */
const CASCADE_THRESHOLD = 0.7;

const stageFor = (
  group: HeadGroup,
  router: NonNullable<PipelineStage['router']>,
  cascadeThreshold?: number
): PipelineStage => ({
  group,
  heads: headSpecsInGroup(group).map((spec) => spec.rubric as HeadId),
  router,
  cascadeThreshold,
});

/** One stage per head group, in ontology order. The stage heads were a hand-written
 *  list of every rubric beside the table that already groups them, so a head added to
 *  a group joined the ontology and not the pipeline. */
export const DEFAULT_PIPELINE_STAGES: readonly PipelineStage[] = [
  stageFor('ingress', 'confidence'),
  stageFor('action', 'cascade', CASCADE_THRESHOLD),
  stageFor('synthesis', 'consensus'),
  stageFor('memory', 'confidence'),
];

/** Default bands for router. The two graded rungs are the confidence router's own
 *  thresholds; below `review` this pipeline abstains rather than blocking, which is
 *  its own policy and the reason it keeps a rung of its own. */
export const DEFAULT_PIPELINE_BANDS: readonly BandConfig[] = [
  { name: 'act', threshold: DEFAULT_CONFIDENCE_BANDS.act, action: 'act' },
  { name: 'review', threshold: DEFAULT_CONFIDENCE_BANDS.review, action: 'review' },
  { name: 'block', threshold: 0.3, action: 'block' },
  { name: 'abstain', threshold: 0, action: 'abstain' },
] as const;

export class JudgmentPipeline {
  private readonly spec: PipelineSpec;
  private readonly heads = new Map<
    HeadId,
    { evaluate: (embedding: Float32Array, query: JudgmentQuery) => Promise<any> }
  >();
  private readonly modelDigest: PipelineModelDigest;

  constructor(spec: Partial<PipelineSpec> = {}) {
    // Create a default embedding cache
    const defaultEmbeddingCache: EmbeddingCache = {
      write: async () => 0 as any,
      read: () => undefined,
    };

    this.spec = {
      id: spec.id ?? 'default',
      version: spec.version ?? '1.0.0',
      stages: spec.stages ?? DEFAULT_PIPELINE_STAGES,
      router: spec.router ?? { type: 'confidence', bands: DEFAULT_PIPELINE_BANDS },
      calibrators: spec.calibrators ?? {},
      headFactoryOptions: spec.headFactoryOptions ?? {
        calibrationVersion: 'v1' as CalibrationVersion,
        embeddingCache: defaultEmbeddingCache,
        abstainThreshold: 0.5,
      },
    };

    // Initialize heads from spec
    for (const stage of this.spec.stages) {
      for (const headId of stage.heads) {
        const headSpec = HEAD_SPECS[headId];
        if (headSpec) {
          const calibratorConfig = this.spec.calibrators[headId] ?? {
            version: 'v1',
            abstainThreshold: 0.5,
          };
          const head = createHead(headSpec, {
            ...this.spec.headFactoryOptions,
            calibrationVersion: calibratorConfig.version as CalibrationVersion,
            abstainThreshold: calibratorConfig.abstainThreshold,
          });
          this.heads.set(headId, head);
        }
      }
    }

    // Compute model digest
    this.modelDigest = this.computeModelDigest();
  }

  /** Run the full pipeline on an embedding and query context. */
  async judge(embedding: Float32Array, queries: JudgmentQuery[]): Promise<JudgmentPipelineResult> {
    const stageResults = new Map<HeadGroup, PipelineHeadResult[]>();
    const allPropositions: PipelineHeadResult[] = [];

    for (const stage of this.spec.stages) {
      const stageQueries = queries.filter((q) => stage.heads.includes(q.rubric as HeadId));
      if (stageQueries.length === 0) continue;

      const stageProps = await this.judgeStage(embedding, stageQueries);
      stageResults.set(stage.group, stageProps);
      allPropositions.push(...stageProps);
    }

    // Apply router to combine/route propositions
    const routedProps = this.applyRouter(allPropositions);

    return {
      propositions: routedProps,
      modelDigest: this.modelDigest,
      stageResults,
    };
  }

  private async judgeStage(
    embedding: Float32Array,
    queries: JudgmentQuery[]
  ): Promise<PipelineHeadResult[]> {
    const results: PipelineHeadResult[] = [];
    for (const query of queries) {
      const head = this.heads.get(query.rubric as HeadId);
      if (!head) continue;
      const result = await head.evaluate(embedding, query);
      results.push(this.toResult(query.rubric as HeadId, result, query));
    }
    return results;
  }

  private toResult(
    rubric: HeadId,
    result: Omit<HeadResult, 'rubric' | 'axis' | 'decisionBand'>,
    query: JudgmentQuery
  ): PipelineHeadResult {
    return {
      rubric,
      axis: query.axis,
      score: result.score,
      distribution: result.distribution,
      legend: result.legend,
      abstained: result.abstained,
      abstainReason: result.abstainReason,
    };
  }

  private applyRouter(propositions: PipelineHeadResult[]): PipelineHeadResult[] {
    const { type, bands } = this.spec.router;
    const bandFor = (score: number) => bands.find((b) => score >= b.threshold) ?? bands.at(-1)!;
    const withBand = (p: PipelineHeadResult): PipelineHeadResult => ({
      ...p,
      decisionBand: bandFor(p.score).action,
    });

    if (type === 'cascade') {
      const threshold = this.spec.router.cascadeThreshold ?? CASCADE_THRESHOLD;
      return propositions.map((p) =>
        p.abstained || p.score < threshold
          ? {
              ...p,
              decisionBand: 'abstain' as const,
              abstained: true,
              abstainReason: 'cascade-threshold',
            }
          : withBand(p)
      );
    }

    return propositions.map(withBand);
  }

  private computeModelDigest(): PipelineModelDigest {
    const encoderDigest = 'encoder-v1';
    const headWeights = this.spec.stages.flatMap((s) => s.heads).join(',');
    const headWeightsDigest = shortSha256Hex(headWeights);
    const specStr = JSON.stringify({
      stages: this.spec.stages,
      router: this.spec.router,
      version: this.spec.version,
    });
    const specHash = shortSha256Hex(specStr);

    return {
      encoderDigest,
      headWeightsDigest,
      specHash,
      createdAt: Date.now(),
    };
  }

  getSpec(): PipelineSpec {
    return this.spec;
  }

  getModelDigest(): PipelineModelDigest {
    return this.modelDigest;
  }

  verifyDigest(digest: PipelineModelDigest): boolean {
    return (
      digest.specHash === this.modelDigest.specHash &&
      digest.headWeightsDigest === this.modelDigest.headWeightsDigest &&
      digest.encoderDigest === this.modelDigest.encoderDigest
    );
  }
}

export function createJudgmentPipeline(overrides: Partial<PipelineSpec> = {}): JudgmentPipeline {
  return new JudgmentPipeline(overrides);
}
