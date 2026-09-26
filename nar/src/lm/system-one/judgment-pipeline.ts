/**
 * JudgmentPipeline — composes over HEAD_SPECS (ordered heads + bands + calibrators + router + cascade).
 * Versioned pipeline ModelDigest for auditability.
 * HEAD_SPECS already declarative; pipeline adds composition + digest, does not replace the table.
 */

import { HEAD_SPECS, HeadSpec, HeadId, HeadGroup, createHead, type HeadFactoryOptions, type JudgmentQuery, type EmbeddingCache, type CalibrationVersion } from './head-specs.js';
import { createHash } from 'node:crypto';

export interface PipelineStage {
  readonly group: HeadGroup;
  readonly heads: readonly HeadId[];
  readonly router?: 'confidence' | 'cascade' | 'consensus';
  readonly cascadeThreshold?: number;
}

export interface BandConfig {
  readonly name: string;
  readonly threshold: number;
  readonly action: 'act' | 'review' | 'block' | 'abstain';
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

export interface PipelineHeadResult {
  readonly rubric: HeadId;
  readonly score: number;
  readonly distribution?: any;
  readonly legend?: any;
  readonly abstained: boolean;
  readonly abstainReason?: string;
  readonly axis: 'epistemic' | 'teleological';
}

export interface JudgmentPipelineResult {
  readonly propositions: PipelineHeadResult[];
  readonly modelDigest: PipelineModelDigest;
  readonly stageResults: Map<HeadGroup, PipelineHeadResult[]>;
}

/** Default pipeline stages matching HEAD_SPECS groups. */
export const DEFAULT_PIPELINE_STAGES: readonly PipelineStage[] = [
  { group: 'ingress', heads: ['task_type', 'illocution', 'injection', 'ambiguity', 'tense', 'source_quality'], router: 'confidence' },
  { group: 'action', heads: ['tool_dispatch', 'risk', 'feasibility', 'strategy', 'reflex_value'], router: 'cascade', cascadeThreshold: 0.7 },
  { group: 'synthesis', heads: ['candidate_select', 'plausibility', 'assertion', 'conflict', 'groundedness'], router: 'consensus' },
  { group: 'memory', heads: ['relevance', 'episodic_match', 'novelty'], router: 'confidence' },
] as const;

/** Default bands for router. */
export const DEFAULT_BANDS: readonly BandConfig[] = [
  { name: 'act', threshold: 0.8, action: 'act' },
  { name: 'review', threshold: 0.5, action: 'review' },
  { name: 'block', threshold: 0.3, action: 'block' },
  { name: 'abstain', threshold: 0, action: 'abstain' },
] as const;

export class JudgmentPipeline {
  private readonly spec: PipelineSpec;
  private readonly heads = new Map<HeadId, { evaluate: (embedding: Float32Array, query: JudgmentQuery) => Promise<any> }>();
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
      router: spec.router ?? { type: 'confidence', bands: DEFAULT_BANDS },
      calibrators: spec.calibrators ?? {},
      headFactoryOptions: spec.headFactoryOptions ?? { calibrationVersion: 'v1' as CalibrationVersion, embeddingCache: defaultEmbeddingCache, abstainThreshold: 0.5 },
    };

    // Initialize heads from spec
    for (const stage of this.spec.stages) {
      for (const headId of stage.heads) {
        const headSpec = HEAD_SPECS[headId];
        if (headSpec) {
          const calibratorConfig = this.spec.calibrators[headId] ?? { version: 'v1', abstainThreshold: 0.5 };
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

      const stageProps = await this.judgeStage(stage, embedding, stageQueries);
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

  private async judgeStage(stage: PipelineStage, embedding: Float32Array, queries: JudgmentQuery[]): Promise<PipelineHeadResult[]> {
    const results: PipelineHeadResult[] = [];
    for (const query of queries) {
      const head = this.heads.get(query.rubric as HeadId);
      if (!head) continue;
      const result = await head.evaluate(embedding, query);
      results.push(this.toResult(query.rubric as HeadId, result, query));
    }
    return results;
  }

  private toResult(rubric: HeadId, result: { score: number; distribution?: any; legend?: any; abstained: boolean; abstainReason?: string }, query: JudgmentQuery): PipelineHeadResult {
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

    if (type === 'confidence') {
      return propositions.map((p) => {
        const band = bands.find((b) => p.score >= b.threshold) ?? bands[bands.length - 1]!;
        return { ...p, decisionBand: band.action };
      });
    }

    if (type === 'cascade') {
      const threshold = this.spec.router.cascadeThreshold ?? 0.7;
      return propositions.map((p) => {
        if (p.abstained || p.score < threshold) {
          return { ...p, decisionBand: 'abstain' as const, abstained: true, abstainReason: 'cascade-threshold' };
        }
        const band = bands.find((b) => p.score >= b.threshold) ?? bands[bands.length - 1]!;
        return { ...p, decisionBand: band.action };
      });
    }

    // Consensus
    return propositions.map((p) => {
      const band = bands.find((b) => p.score >= b.threshold) ?? bands[bands.length - 1]!;
      return { ...p, decisionBand: band.action };
    });
  }

  private computeModelDigest(): PipelineModelDigest {
    const encoderDigest = 'encoder-v1';
    const headWeights = this.spec.stages.flatMap((s) => s.heads).join(',');
    const headWeightsDigest = createHash('sha256').update(headWeights).digest('hex').slice(0, 16);
    const specStr = JSON.stringify({
      stages: this.spec.stages,
      router: this.spec.router,
      version: this.spec.version,
    });
    const specHash = createHash('sha256').update(specStr).digest('hex').slice(0, 16);

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
    return digest.specHash === this.modelDigest.specHash &&
           digest.headWeightsDigest === this.modelDigest.headWeightsDigest &&
           digest.encoderDigest === this.modelDigest.encoderDigest;
  }
}

export function createJudgmentPipeline(overrides: Partial<PipelineSpec> = {}): JudgmentPipeline {
  return new JudgmentPipeline(overrides);
}

export const defaultJudgmentPipeline = createJudgmentPipeline();