/**
 * System One file config — zod schema + defaults.
 * Owned here (single definition); root src/config/schema.ts and @senars/nar re-export.
 */
import { z } from 'zod';

export const systemOneDefaults = {
  enabled: false,
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
    maxJudgmentCallsPerCycle: 8,
    maxConsensusPerCycle: 2,
    maxLatencyMsPerJudgment: 33,
    maxTokensPerCycle: 4096,
    maxMemoryMbPerCycle: 256,
  },
  provisional: { cInitial: 0.1, decayRate: 0.3, maxTtlMs: 30000 },
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
  lmReflex: { grammarActions: true, maxCandidates: 3 },
  handover: { reviewAction: 'escalate-baseline' as const, minBaselineConfidence: 0.5 },
} as const;

export const systemOneSchema = z.object({
  enabled: z.boolean().default(systemOneDefaults.enabled),
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
      maxJudgmentCallsPerCycle: z
        .number()
        .int()
        .positive()
        .default(systemOneDefaults.budgets.maxJudgmentCallsPerCycle),
      maxConsensusPerCycle: z
        .number()
        .int()
        .positive()
        .default(systemOneDefaults.budgets.maxConsensusPerCycle),
      maxLatencyMsPerJudgment: z
        .number()
        .int()
        .positive()
        .default(systemOneDefaults.budgets.maxLatencyMsPerJudgment),
      maxTokensPerCycle: z
        .number()
        .int()
        .positive()
        .default(systemOneDefaults.budgets.maxTokensPerCycle),
      maxMemoryMbPerCycle: z
        .number()
        .int()
        .positive()
        .default(systemOneDefaults.budgets.maxMemoryMbPerCycle),
    })
    .default(systemOneDefaults.budgets),
  provisional: z
    .object({
      cInitial: z.number().min(0).max(1).default(systemOneDefaults.provisional.cInitial),
      decayRate: z.number().positive().default(systemOneDefaults.provisional.decayRate),
      maxTtlMs: z.number().int().positive().default(systemOneDefaults.provisional.maxTtlMs),
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
