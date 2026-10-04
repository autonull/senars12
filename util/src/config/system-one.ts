/**
 * System One file config — zod schema + defaults.
 * Owned here (single definition); root src/config/schema.ts and @senars/nar re-export.
 */
import { z } from 'zod';

/**
 * Min/max/default/step for the System One knobs a tuner may move.
 *
 * The System One counterpart to `cognitiveBounds`, and the reason the tuner can
 * reach every value the config admits: the numbers lived in three places, and
 * only two of them were the table. `rlfp/knobs.ts` bounded these eight rows by
 * hand while `systemOneSchema` below declared five of them unbounded — so the
 * schema admitted `maxTokensPerCycle: 1e12` and the tuner could not have
 * proposed it, and `provisional.cInitial` was capped at 1 by one and 0.5 by the
 * other.
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

export type SystemOneBoundCategory = keyof typeof systemOneBounds;
export type SystemOneBoundKey<C extends SystemOneBoundCategory> = keyof (typeof systemOneBounds)[C];

interface BoundRow {
  readonly min: number;
  readonly max: number;
  readonly default: number;
  readonly step: number;
}

const row = <C extends SystemOneBoundCategory, K extends SystemOneBoundKey<C>>(
  category: C,
  key: K
): BoundRow => systemOneBounds[category][key] as BoundRow;

/**
 * One row projected to its `{min,max,step}` triple — the search space a tuner
 * scans. Mirrors `boundSpec` for `cognitiveBounds`.
 */
export function systemOneBoundSpec<C extends SystemOneBoundCategory, K extends SystemOneBoundKey<C>>(
  category: C,
  key: K
): { readonly min: number; readonly max: number; readonly step: number } {
  const bounds = row(category, key);
  return { min: bounds.min, max: bounds.max, step: bounds.step };
}

/** One bound, so the schema and the defaults quote the same number. */
const bound = <C extends SystemOneBoundCategory, K extends SystemOneBoundKey<C>>(
  category: C,
  key: K,
  prop: 'min' | 'max' | 'default'
): number => row(category, key)[prop];

/** A positive integer inside the row's range, defaulting to the row's own. */
const boundedInt = <C extends SystemOneBoundCategory, K extends SystemOneBoundKey<C>>(
  category: C,
  key: K
) =>
  z
    .number()
    .int()
    .min(bound(category, key, 'min'))
    .max(bound(category, key, 'max'))
    .default(bound(category, key, 'default'));

/** A real inside the row's range, defaulting to the row's own. */
const boundedNumber = <C extends SystemOneBoundCategory, K extends SystemOneBoundKey<C>>(
  category: C,
  key: K
) =>
  z
    .number()
    .min(bound(category, key, 'min'))
    .max(bound(category, key, 'max'))
    .default(bound(category, key, 'default'));

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
    maxJudgmentCallsPerCycle: bound('budgets', 'maxJudgmentCallsPerCycle', 'default'),
    maxConsensusPerCycle: bound('budgets', 'maxConsensusPerCycle', 'default'),
    maxLatencyMsPerJudgment: bound('budgets', 'maxLatencyMsPerJudgment', 'default'),
    maxTokensPerCycle: bound('budgets', 'maxTokensPerCycle', 'default'),
    maxMemoryMbPerCycle: bound('budgets', 'maxMemoryMbPerCycle', 'default'),
  },
  provisional: {
    cInitial: bound('provisional', 'cInitial', 'default'),
    decayRate: bound('provisional', 'decayRate', 'default'),
    maxTtlMs: bound('provisional', 'maxTtlMs', 'default'),
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
  judgeTimeoutMs: z.number().int().positive().default(systemOneDefaults.judgeTimeoutMs),
  manifold: z
    .object({
      provider: z
        .enum(['off', 'wasi', 'webgpu', 'http', 'peer', 'open-systemone'])
        .default(systemOneDefaults.manifold.provider),
      endpoint: z.string().optional(),
      timeoutMs: z.number().int().positive().optional(),
      embeddingCacheSizeMB: z
        .number()
        .int()
        .positive()
        .default(systemOneDefaults.manifold.embeddingCacheSizeMB),
      encoder: z
        .object({
          modelId: z.string().default(systemOneDefaults.manifold.encoder.modelId),
          dimension: z
            .number()
            .int()
            .positive()
            .default(systemOneDefaults.manifold.encoder.dimension),
        })
        .default(systemOneDefaults.manifold.encoder),
      heads: z
        .record(
          z.string(),
          z.object({
            modelDigest: z.string(),
            calibrationVersion: z.string(),
            abstainThreshold: z.number().min(0).max(1),
            enabled: z.boolean(),
          })
        )
        .default({}),
      consensus: z
        .object({
          criticalityFloor: z
            .enum(['low', 'standard', 'high', 'critical'])
            .default(systemOneDefaults.manifold.consensus.criticalityFloor),
          fanout: z.number().int().positive().default(systemOneDefaults.manifold.consensus.fanout),
          minAgreement: z
            .number()
            .min(0)
            .max(1)
            .default(systemOneDefaults.manifold.consensus.minAgreement),
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
      maxJudgmentCallsPerCycle: boundedInt('budgets', 'maxJudgmentCallsPerCycle'),
      maxConsensusPerCycle: boundedInt('budgets', 'maxConsensusPerCycle'),
      maxLatencyMsPerJudgment: boundedInt('budgets', 'maxLatencyMsPerJudgment'),
      maxTokensPerCycle: boundedInt('budgets', 'maxTokensPerCycle'),
      maxMemoryMbPerCycle: boundedInt('budgets', 'maxMemoryMbPerCycle'),
    })
    .default(systemOneDefaults.budgets),
  provisional: z
    .object({
      cInitial: boundedNumber('provisional', 'cInitial'),
      decayRate: boundedNumber('provisional', 'decayRate'),
      maxTtlMs: boundedInt('provisional', 'maxTtlMs'),
    })
    .default(systemOneDefaults.provisional),
  distillation: z
    .object({
      datasetPath: z.string().default(systemOneDefaults.distillation.datasetPath),
      bakeOffSamplingRate: z
        .number()
        .min(0)
        .max(1)
        .default(systemOneDefaults.distillation.bakeOffSamplingRate),
      driftEceBound: z.number().min(0).max(1).default(systemOneDefaults.distillation.driftEceBound),
      /** E4c: opt-in periodic append of dataset rows — default config no longer writes dataset files silently. */
      autoFlush: z.boolean().optional(),
      /** E4a: JSONL path persisting per-cycle trajectories for implicit preference pairing. */
      trajectoryPath: z.string().optional(),
    })
    .default(systemOneDefaults.distillation),
  rl: z
    .object({
      policy: z.enum(['eps-greedy', 'ucb']).default(systemOneDefaults.rl.policy),
      epsilon: z.number().min(0).max(1).default(systemOneDefaults.rl.epsilon),
      ucbC: z.number().min(0).default(systemOneDefaults.rl.ucbC),
      feasibilityMask: z.boolean().default(systemOneDefaults.rl.feasibilityMask),
      riskFloor: z.number().min(0).max(1).default(systemOneDefaults.rl.riskFloor),
      labelOutcomes: z.boolean().default(systemOneDefaults.rl.labelOutcomes),
    })
    .default(systemOneDefaults.rl),
  egressJudging: z
    .object({
      enabled: z.boolean().default(systemOneDefaults.egressJudging.enabled),
      rubric: z.literal('conflict').default(systemOneDefaults.egressJudging.rubric),
      maxCandidates: z
        .number()
        .int()
        .positive()
        .default(systemOneDefaults.egressJudging.maxCandidates),
      vetoThreshold: z
        .number()
        .min(0)
        .max(1)
        .default(systemOneDefaults.egressJudging.vetoThreshold),
    })
    .default(systemOneDefaults.egressJudging),
  lmReflex: z
    .object({
      grammarActions: z.boolean().default(systemOneDefaults.lmReflex.grammarActions),
      maxCandidates: z.number().int().positive().default(systemOneDefaults.lmReflex.maxCandidates),
    })
    .default(systemOneDefaults.lmReflex),
  handover: z
    .object({
      reviewAction: z
        .enum(['escalate-baseline', 'abstain', 'act'])
        .default(systemOneDefaults.handover.reviewAction),
      minBaselineConfidence: z
        .number()
        .min(0)
        .max(1)
        .default(systemOneDefaults.handover.minBaselineConfidence),
    })
    .default(systemOneDefaults.handover),
});

export type SystemOneConfig = z.infer<typeof systemOneSchema>;
