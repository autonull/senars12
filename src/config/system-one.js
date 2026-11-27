/**
 * System One file config — zod schema + defaults.
 * Owned here (single definition); root src/config/schema.ts and @senars/nar re-export.
 */
import { z } from 'zod';
import { positiveInt, unitInterval } from './boundary';
import { systemOneBound, SYSTEM_ONE_DEFAULT_PATHS, buildDefaultsFromBounds } from './bound-table';
/** How much a judgment is trusted to decide on its own. Declared once because it was
 *  written out six times — as a type in the decision layer, four times as an inline
 *  `z.enum` in the System One HTTP contract, and once as `criticalityFloor`'s options in
 *  the config schema below — so a level added in one place was missing from five. */
export const CRITICALITY_LEVELS = ['low', 'standard', 'high', 'critical'];
export const criticalitySchema = z.enum(CRITICALITY_LEVELS);
const boundDefaults = buildDefaultsFromBounds(systemOneBound, [...SYSTEM_ONE_DEFAULT_PATHS]);
export const systemOneDefaults = {
    enabled: false,
    /** The bound on one ingress judgment (TODO29.a A1): a judge that hangs is refused, not awaited. */
    judgeTimeoutMs: 2000,
    manifold: {
        provider: 'off',
        embeddingCacheSizeMB: 64,
        encoder: { modelId: 'Xenova/all-MiniLM-L6-v2', dimension: 384 },
        heads: {},
        consensus: { criticalityFloor: 'high', fanout: 3, minAgreement: 0.66 },
    },
    cortex: { provider: 'off', model: undefined },
    budgets: {
        maxJudgmentCallsPerCycle: boundDefaults.budgets.maxJudgmentCallsPerCycle,
        maxConsensusPerCycle: boundDefaults.budgets.maxConsensusPerCycle,
        maxLatencyMsPerJudgment: boundDefaults.budgets.maxLatencyMsPerJudgment,
        maxTokensPerCycle: boundDefaults.budgets.maxTokensPerCycle,
        maxMemoryMbPerCycle: boundDefaults.budgets.maxMemoryMbPerCycle,
    },
    provisional: {
        cInitial: boundDefaults.provisional.cInitial,
        decayRate: boundDefaults.provisional.decayRate,
        maxTtlMs: boundDefaults.provisional.maxTtlMs,
    },
    distillation: {
        datasetPath: './data/systemone-distillation.jsonl',
        bakeOffSamplingRate: 0.1,
        driftEceBound: 0.15,
        autoFlush: false,
    },
    rl: {
        policy: 'eps-greedy',
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
        rubric: 'conflict',
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
    handover: { reviewAction: 'escalate-baseline', minBaselineConfidence: 0.5 },
};
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
            .record(z.string(), z.object({
            modelDigest: z.string(),
            calibrationVersion: z.string(),
            abstainThreshold: unitInterval,
            enabled: z.boolean(),
        }))
            .default({}),
        consensus: z
            .object({
            criticalityFloor: criticalitySchema.default(systemOneDefaults.manifold.consensus.criticalityFloor),
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
