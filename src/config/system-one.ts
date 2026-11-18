/**
 * System One file config — zod schema + defaults.
 * Owned here (single definition); root src/config/schema.ts and @senars/nar re-export.
 */
import { z } from 'zod';
import { positiveInt, unitInterval } from './boundary.js';
import { nestedBounds } from './bounds.js';

/** How much a judgment is trusted to decide on its own. Declared once because it was
 *  written out six times — as a type in the decision layer, four times as an inline
 *  `z.enum` in the System One HTTP contract, and once as `criticalityFloor`'s options in
 *  the config schema below — so a level added in one place was missing from five. */
export const CRITICALITY_LEVELS = ['low', 'standard', 'high', 'critical'] as const;

export type CriticalityLevel = (typeof CRITICALITY_LEVELS)[number];

export const criticalitySchema = z.enum(CRITICALITY_LEVELS);

/**
 * Min/max/default/step for the System One knobs a tuner may move.
 *
 * The System One counterpart to `cognitiveBounds`, and the reason the tuner can reach every
 * value the config admits: the numbers lived in three places, and only two of them were the
 * table. `rlfp/knobs.ts` bounded these eight rows by hand while `systemOneSchema` below
 * declared five of them unbounded — so the schema admitted `maxTokensPerCycle: 1e12` and the
 * tuner could not have proposed it, and `provisional.cInitial` was capped at 1 by one and
 * 0.5 by the other.
 */
export const systemOneBounds = {
  budgets: {
    maxJudgmentCallsPerCycle: { min: 1, max: 32, default: 8, step: 1 },
    maxConsensusPerCycle: { min: 1, max: 8, default: 2, step: 1 },
    maxLatencyMsPerJudgment: { min: 10, max: 200, default: 33, step: 1 },
    maxTokensPerCycle: { min: 256, max: 32768, default: 4096, step: 256 },
    maxMemoryMbPerCycle: { min: 32, max: 2048, default: 256, step: 32 },
  },
  provisional: {
    cInitial: { min: 0.01, max: 0.5, default: 0.1, step: 0.01 },
    decayRate: { min: 0.05, max: 1.0, default: 0.3, step: 0.05 },
    maxTtlMs: { min: 5000, max: 300000, default: 30000, step: 5000 },
  },
} as const;

export type SystemOneBounds = typeof systemOneBounds;
export type SystemOneBoundCategory = keyof SystemOneBounds;
export type SystemOneBoundKey<C extends SystemOneBoundCategory> = keyof SystemOneBounds[C];

/**
 * The one reader of {@link systemOneBounds}, addressed as `category.key`.
 *
 * This table shipped its own `BoundRow` — a fourth declaration of a shape two other bound
 * tables already declared — plus a private `bound(category, key, prop)` and a pair of
 * builders that restated the same `.min().max().default()` chain. The row has one shape and
 * one set of projections now; this table contributes only its numbers.
 */
export const systemOneBound = nestedBounds(systemOneBounds);

export const systemOneDefaults = {
  enabled: false,
  /** The bound on one ingress judgment (TODO29.a A1): a judge that hangs is refused, not awaited. */
  judgeTimeoutMs: 2000,
  manifold: {
    provider: 'off' as const,
    embeddingCacheSizeMB: 64,
    encoder: { modelId: 'Xenova/all-MiniLM-L6-v2', dimension: 384 },
    heads: {} as Record<
      string,
      {
        modelDigest: string;
        calibrationVersion: string;
        abstainThreshold: number;
        enabled: boolean;
      }
    >,
    consensus: { criticalityFloor: 'high' as const, fanout: 3, minAgreement: 0.66 },
  },
  cortex: { provider: 'off' as const, model: undefined as string | undefined },
  budgets: {
    maxJudgmentCallsPerCycle: systemOneBound.at('budgets.maxJudgmentCallsPerCycle', 'default'),
    maxConsensusPerCycle: systemOneBound.at('budgets.maxConsensusPerCycle', 'default'),
    maxLatencyMsPerJudgment: systemOneBound.at('budgets.maxLatencyMsPerJudgment', 'default'),
    maxTokensPerCycle: systemOneBound.at('budgets.maxTokensPerCycle', 'default'),
    maxMemoryMbPerCycle: systemOneBound.at('budgets.maxMemoryMbPerCycle', 'default'),
  },
  provisional: {
    cInitial: systemOneBound.at('provisional.cInitial', 'default'),
    decayRate: systemOneBound.at('provisional.decayRate', 'default'),
    maxTtlMs: systemOneBound.at('provisional.maxTtlMs', 'default'),
  },
  distillation: {
    datasetPath: './data/systemone-distillation.jsonl',
    bakeOffSamplingRate: 0.1,
    driftEceBound: 0.15,
    autoFlush: false,
  },
  rl: {
    policy: 'eps-greedy' as const,
    epsilon: 0.1,
    ucbC: 0.5,
    feasibilityMask: true,
    riskFloor: 0.8,
    labelOutcomes: true,
  },
  egressJudging: {
    /**
     * TODO32 M2. Off by default: with it off the committed set is byte-identical
     * to a NAR that has never heard of egress judging, and that invariance is the
     * gate (`egress:invariant`), not a claim.
     */
    enabled: false,
    /**
     * `conflict` by default — it is the one epistemic evaluate head that asks the
     * right question of a *conclusion* ("does this contradict what is already
     * committed?"). `risk` is the tempting alternative and is **wrong**: it is
     * declared `axis: 'teleological'`, and a teleological head judging admission
     * is the firewall crossed rather than enforced.
     */
    rubric: 'conflict' as const,
    /**
     * How many ranked candidates one cycle may put to the judge. Bounded because
     * an `evaluate` head judges one embedding, so this is one embedding plus one
     * head evaluation per candidate — an unbounded sweep would make cognition cost
     * scale with `ranking.maxAdmissions`.
     */
    maxCandidates: 4,
    /** Score at or above which a conclusion is vetoed. The rubric's legend is
     *  ordered, so the score *is* the level: 0 is the lowest, 1 the highest. */
    vetoThreshold: 0.75,
  },
  lmReflex: { grammarActions: true, maxCandidates: 3 },
  handover: { reviewAction: 'escalate-baseline' as const, minBaselineConfidence: 0.5 },
} as const;

export const systemOneSchema = z.object({
  enabled: z.boolean().default(systemOneDefaults.enabled),
  judgeTimeoutMs: positiveInt.default(systemOneDefaults.judgeTimeoutMs),
  manifold: z
    .object({
      provider: z
        .enum(['off', 'wasi', 'webgpu', 'http', 'peer', 'open-systemone'])
        .default(systemOneDefaults.manifold.provider),
      endpoint: z.string().optional(),
      timeoutMs: positiveInt.optional(),
      embeddingCacheSizeMB: positiveInt.default(systemOneDefaults.manifold.embeddingCacheSizeMB),
      encoder: z
        .object({
          modelId: z.string().default(systemOneDefaults.manifold.encoder.modelId),
          dimension: positiveInt.default(systemOneDefaults.manifold.encoder.dimension),
        })
        .default(systemOneDefaults.manifold.encoder),
      heads: z
        .record(
          z.string(),
          z.object({
            modelDigest: z.string(),
            calibrationVersion: z.string(),
            abstainThreshold: unitInterval,
            enabled: z.boolean(),
          })
        )
        .default({}),
      consensus: z
        .object({
          criticalityFloor: criticalitySchema.default(
            systemOneDefaults.manifold.consensus.criticalityFloor
          ),
          fanout: positiveInt.default(systemOneDefaults.manifold.consensus.fanout),
          minAgreement: unitInterval.default(systemOneDefaults.manifold.consensus.minAgreement),
        })
        .default(systemOneDefaults.manifold.consensus),
    })
    .default(systemOneDefaults.manifold),
  cortex: z
    .object({
      provider: z
        .enum([
          'off',
          'anthropic',
          'openai',
          'openai-compatible',
          'ollama',
          'llamacpp',
          'llamacpp-embedded',
          'transformers',
          'webllm',
          'mock',
        ])
        .default(systemOneDefaults.cortex.provider),
      /** H2/X16: per-domain model binding — Cortex candidates route through this id. */
      model: z.string().optional(),
    })
    .default(systemOneDefaults.cortex),
  budgets: z
    .object({
      maxJudgmentCallsPerCycle: systemOneBound.schema('budgets.maxJudgmentCallsPerCycle', {
        int: true,
      }),
      maxConsensusPerCycle: systemOneBound.schema('budgets.maxConsensusPerCycle', { int: true }),
      maxLatencyMsPerJudgment: systemOneBound.schema('budgets.maxLatencyMsPerJudgment', {
        int: true,
      }),
      maxTokensPerCycle: systemOneBound.schema('budgets.maxTokensPerCycle', { int: true }),
      maxMemoryMbPerCycle: systemOneBound.schema('budgets.maxMemoryMbPerCycle', { int: true }),
    })
    .default(systemOneDefaults.budgets),
  provisional: z
    .object({
      cInitial: systemOneBound.schema('provisional.cInitial'),
      decayRate: systemOneBound.schema('provisional.decayRate'),
      maxTtlMs: systemOneBound.schema('provisional.maxTtlMs', { int: true }),
    })
    .default(systemOneDefaults.provisional),
  distillation: z
    .object({
      datasetPath: z.string().default(systemOneDefaults.distillation.datasetPath),
      bakeOffSamplingRate: unitInterval.default(systemOneDefaults.distillation.bakeOffSamplingRate),
      driftEceBound: unitInterval.default(systemOneDefaults.distillation.driftEceBound),
      /** E4c: opt-in periodic append of dataset rows — default config no longer writes dataset files silently. */
      autoFlush: z.boolean().optional(),
      /** E4a: JSONL path persisting per-cycle trajectories for implicit preference pairing. */
      trajectoryPath: z.string().optional(),
    })
    .default(systemOneDefaults.distillation),
  rl: z
    .object({
      policy: z.enum(['eps-greedy', 'ucb']).default(systemOneDefaults.rl.policy),
      epsilon: unitInterval.default(systemOneDefaults.rl.epsilon),
      ucbC: z.number().min(0).default(systemOneDefaults.rl.ucbC),
      feasibilityMask: z.boolean().default(systemOneDefaults.rl.feasibilityMask),
      riskFloor: unitInterval.default(systemOneDefaults.rl.riskFloor),
      labelOutcomes: z.boolean().default(systemOneDefaults.rl.labelOutcomes),
    })
    .default(systemOneDefaults.rl),
  egressJudging: z
    .object({
      enabled: z.boolean().default(systemOneDefaults.egressJudging.enabled),
      rubric: z.literal('conflict').default(systemOneDefaults.egressJudging.rubric),
      maxCandidates: positiveInt.default(systemOneDefaults.egressJudging.maxCandidates),
      vetoThreshold: unitInterval.default(systemOneDefaults.egressJudging.vetoThreshold),
    })
    .default(systemOneDefaults.egressJudging),
  lmReflex: z
    .object({
      grammarActions: z.boolean().default(systemOneDefaults.lmReflex.grammarActions),
      maxCandidates: positiveInt.default(systemOneDefaults.lmReflex.maxCandidates),
    })
    .default(systemOneDefaults.lmReflex),
  handover: z
    .object({
      reviewAction: z
        .enum(['escalate-baseline', 'abstain', 'act'])
        .default(systemOneDefaults.handover.reviewAction),
      minBaselineConfidence: unitInterval.default(systemOneDefaults.handover.minBaselineConfidence),
    })
    .default(systemOneDefaults.handover),
});

export type SystemOneConfig = z.infer<typeof systemOneSchema>;
