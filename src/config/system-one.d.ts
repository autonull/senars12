/**
 * System One file config — zod schema + defaults.
 * Owned here (single definition); root src/config/schema.ts and @senars/nar re-export.
 */
import { z } from 'zod';
import { type SystemOneBounds, type SystemOneBoundCategory, type SystemOneBoundKey } from './bound-table';
/** How much a judgment is trusted to decide on its own. Declared once because it was
 *  written out six times — as a type in the decision layer, four times as an inline
 *  `z.enum` in the System One HTTP contract, and once as `criticalityFloor`'s options in
 *  the config schema below — so a level added in one place was missing from five. */
export declare const CRITICALITY_LEVELS: readonly ['low', 'standard', 'high', 'critical'];
export type CriticalityLevel = (typeof CRITICALITY_LEVELS)[number];
export declare const criticalitySchema: z.ZodEnum<{
    critical: "critical";
    high: "high";
    low: "low";
    standard: "standard";
}>;
export { type SystemOneBounds, type SystemOneBoundCategory, type SystemOneBoundKey };
export declare const systemOneDefaults: {
    readonly enabled: false;
    /** The bound on one ingress judgment (TODO29.a A1): a judge that hangs is refused, not awaited. */
    readonly judgeTimeoutMs: 2000;
    readonly manifold: {
        readonly provider: 'off';
        readonly embeddingCacheSizeMB: 64;
        readonly encoder: {
            readonly modelId: 'Xenova/all-MiniLM-L6-v2';
            readonly dimension: 384;
        };
        readonly heads: Record<string, {
            modelDigest: string;
            calibrationVersion: string;
            abstainThreshold: number;
            enabled: boolean;
        }>;
        readonly consensus: {
            readonly criticalityFloor: 'high';
            readonly fanout: 3;
            readonly minAgreement: 0.66;
        };
    };
    readonly cortex: {
        readonly provider: 'off';
        readonly model: string | undefined;
    };
    readonly budgets: {
        readonly maxJudgmentCallsPerCycle: number;
        readonly maxConsensusPerCycle: number;
        readonly maxLatencyMsPerJudgment: number;
        readonly maxTokensPerCycle: number;
        readonly maxMemoryMbPerCycle: number;
    };
    readonly provisional: {
        readonly cInitial: number;
        readonly decayRate: number;
        readonly maxTtlMs: number;
    };
    readonly distillation: {
        readonly datasetPath: './data/systemone-distillation.jsonl';
        readonly bakeOffSamplingRate: 0.1;
        readonly driftEceBound: 0.15;
        readonly autoFlush: false;
    };
    readonly rl: {
        readonly policy: 'eps-greedy';
        readonly epsilon: 0.1;
        readonly ucbC: 0.5;
        readonly feasibilityMask: true;
        readonly riskFloor: 0.8;
        readonly labelOutcomes: true;
    };
    readonly egressJudging: {
        /**
         * TODO32 M2. Off by default: with it off the committed set is byte-identical
         * to a NAR that has never heard of egress judging, and that invariance is the
         * gate (`egress:invariant`), not a claim.
         */
        readonly enabled: false;
        /**
         * `conflict` by default — it is the one epistemic evaluate head that asks the
         * right question of a *conclusion* ("does this contradict what is already
         * committed?"). `risk` is the tempting alternative and is **wrong**: it is
         * declared `axis: 'teleological'`, and a teleological head judging admission
         * is the firewall crossed rather than enforced.
         */
        readonly rubric: 'conflict';
        /**
         * How many ranked candidates one cycle may put to the judge. Bounded because
         * an `evaluate` head judges one embedding, so this is one embedding plus one
         * head evaluation per candidate — an unbounded sweep would make cognition cost
         * scale with `ranking.maxAdmissions`.
         */
        readonly maxCandidates: 4;
        /** Score at or above which a conclusion is vetoed. The rubric's legend is
         *  ordered, so the score *is* the level: 0 is the lowest, 1 the highest. */
        readonly vetoThreshold: 0.75;
    };
    readonly lmReflex: {
        readonly grammarActions: true;
        readonly maxCandidates: 3;
    };
    readonly handover: {
        readonly reviewAction: 'escalate-baseline';
        readonly minBaselineConfidence: 0.5;
    };
};
export declare const systemOneSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    judgeTimeoutMs: z.ZodDefault<z.ZodNumber>;
    manifold: z.ZodDefault<z.ZodObject<{
        provider: z.ZodDefault<z.ZodEnum<{
            http: "http";
            off: "off";
            "open-systemone": "open-systemone";
            peer: "peer";
            wasi: "wasi";
            webgpu: "webgpu";
        }>>;
        endpoint: z.ZodOptional<z.ZodString>;
        timeoutMs: z.ZodOptional<z.ZodNumber>;
        embeddingCacheSizeMB: z.ZodDefault<z.ZodNumber>;
        encoder: z.ZodDefault<z.ZodObject<{
            modelId: z.ZodDefault<z.ZodString>;
            dimension: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
        heads: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
            modelDigest: z.ZodString;
            calibrationVersion: z.ZodString;
            abstainThreshold: z.ZodNumber;
            enabled: z.ZodBoolean;
        }, z.core.$strip>>>;
        consensus: z.ZodDefault<z.ZodObject<{
            criticalityFloor: z.ZodDefault<z.ZodEnum<{
                critical: "critical";
                high: "high";
                low: "low";
                standard: "standard";
            }>>;
            fanout: z.ZodDefault<z.ZodNumber>;
            minAgreement: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    cortex: z.ZodDefault<z.ZodObject<{
        provider: z.ZodDefault<z.ZodEnum<{
            anthropic: "anthropic";
            llamacpp: "llamacpp";
            "llamacpp-embedded": "llamacpp-embedded";
            mock: "mock";
            off: "off";
            ollama: "ollama";
            openai: "openai";
            "openai-compatible": "openai-compatible";
            transformers: "transformers";
            webllm: "webllm";
        }>>;
        model: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    budgets: z.ZodDefault<z.ZodObject<{
        maxJudgmentCallsPerCycle: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
        maxConsensusPerCycle: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
        maxLatencyMsPerJudgment: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
        maxTokensPerCycle: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
        maxMemoryMbPerCycle: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
    }, z.core.$strip>>;
    provisional: z.ZodDefault<z.ZodObject<{
        cInitial: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
        decayRate: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
        maxTtlMs: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
    }, z.core.$strip>>;
    distillation: z.ZodDefault<z.ZodObject<{
        datasetPath: z.ZodDefault<z.ZodString>;
        bakeOffSamplingRate: z.ZodDefault<z.ZodNumber>;
        driftEceBound: z.ZodDefault<z.ZodNumber>;
        autoFlush: z.ZodOptional<z.ZodBoolean>;
        trajectoryPath: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    rl: z.ZodDefault<z.ZodObject<{
        policy: z.ZodDefault<z.ZodEnum<{
            "eps-greedy": "eps-greedy";
            ucb: "ucb";
        }>>;
        epsilon: z.ZodDefault<z.ZodNumber>;
        ucbC: z.ZodDefault<z.ZodNumber>;
        feasibilityMask: z.ZodDefault<z.ZodBoolean>;
        riskFloor: z.ZodDefault<z.ZodNumber>;
        labelOutcomes: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
    egressJudging: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        rubric: z.ZodDefault<z.ZodLiteral<"conflict">>;
        maxCandidates: z.ZodDefault<z.ZodNumber>;
        vetoThreshold: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
    lmReflex: z.ZodDefault<z.ZodObject<{
        grammarActions: z.ZodDefault<z.ZodBoolean>;
        maxCandidates: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
    handover: z.ZodDefault<z.ZodObject<{
        reviewAction: z.ZodDefault<z.ZodEnum<{
            abstain: "abstain";
            act: "act";
            "escalate-baseline": "escalate-baseline";
        }>>;
        minBaselineConfidence: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type SystemOneConfig = z.infer<typeof systemOneSchema>;
//# sourceMappingURL=system-one.d.ts.map