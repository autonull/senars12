import { z } from 'zod';
/**
 * Canonical field shape for LM settings — shared by @senars/nar/lm (LMSettings),
 * src/config (senars.config.json `lm` block), and tooling/config UIs.
 * Exported as a raw shape so consumers compose it with their own zod version.
 */
export declare const lmSettingsShape: {
    readonly provider: z.ZodOptional<z.ZodString>;
    /** Named preset: auto | cloud-quality | local-private | ollama. */
    readonly profile: z.ZodOptional<z.ZodString>;
    readonly model: z.ZodOptional<z.ZodString>;
    readonly fastModel: z.ZodOptional<z.ZodString>;
    readonly structuredModel: z.ZodOptional<z.ZodString>;
    readonly compactModel: z.ZodOptional<z.ZodString>;
    readonly baseUrl: z.ZodOptional<z.ZodString>;
    readonly ollamaHost: z.ZodOptional<z.ZodString>;
    readonly apiKeyEnv: z.ZodOptional<z.ZodString>;
    /** llama.cpp server host (llama-server native API). */
    readonly llamacppHost: z.ZodOptional<z.ZodString>;
    /** Embedded llama.cpp: path to a GGUF model file. */
    readonly llamacppModelPath: z.ZodOptional<z.ZodString>;
    /** Embedded llama.cpp: GPU backend (`auto` | `cuda` | `metal` | `vulkan` | `false`). */
    readonly llamacppGpu: z.ZodOptional<z.ZodUnion<readonly [z.ZodEnum<{
        auto: "auto";
        cuda: "cuda";
        metal: "metal";
        vulkan: "vulkan";
    }>, z.ZodLiteral<false>]>>;
    /** Embedded llama.cpp: layers to offload (`max` or a count). */
    readonly llamacppGpuLayers: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"max">]>>;
    /** Embedded llama.cpp: context window size. */
    readonly llamacppContextSize: z.ZodOptional<z.ZodNumber>;
    /** Embedded llama.cpp: batch size. */
    readonly llamacppBatchSize: z.ZodOptional<z.ZodNumber>;
    /** Embedded llama.cpp: parallel sequences. */
    readonly llamacppSequences: z.ZodOptional<z.ZodNumber>;
    /** Embedded llama.cpp: flash attention. */
    readonly llamacppFlashAttention: z.ZodOptional<z.ZodBoolean>;
    /** Hard offline switch — never probe or reach the network. */
    readonly offline: z.ZodOptional<z.ZodBoolean>;
    /** Disable thinking-model reasoning traces (Qwen3 etc.). */
    readonly disableThinking: z.ZodOptional<z.ZodBoolean>;
    readonly quantized: z.ZodOptional<z.ZodBoolean>;
    readonly cacheDir: z.ZodOptional<z.ZodString>;
    /** Per-provider circuit breaker settings. */
    readonly circuitBreaker: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        failureThreshold: z.ZodOptional<z.ZodNumber>;
        resetTimeoutMs: z.ZodOptional<z.ZodNumber>;
        successThreshold: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>;
};
/** Canonical LM settings schema (composed from the raw shape). */
export declare const lmSettingsSchema: z.ZodObject<{
    provider: z.ZodOptional<z.ZodString>;
    profile: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    fastModel: z.ZodOptional<z.ZodString>;
    structuredModel: z.ZodOptional<z.ZodString>;
    compactModel: z.ZodOptional<z.ZodString>;
    baseUrl: z.ZodOptional<z.ZodString>;
    ollamaHost: z.ZodOptional<z.ZodString>;
    apiKeyEnv: z.ZodOptional<z.ZodString>;
    llamacppHost: z.ZodOptional<z.ZodString>;
    llamacppModelPath: z.ZodOptional<z.ZodString>;
    llamacppGpu: z.ZodOptional<z.ZodUnion<readonly [z.ZodEnum<{
        auto: "auto";
        cuda: "cuda";
        metal: "metal";
        vulkan: "vulkan";
    }>, z.ZodLiteral<false>]>>;
    llamacppGpuLayers: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"max">]>>;
    llamacppContextSize: z.ZodOptional<z.ZodNumber>;
    llamacppBatchSize: z.ZodOptional<z.ZodNumber>;
    llamacppSequences: z.ZodOptional<z.ZodNumber>;
    llamacppFlashAttention: z.ZodOptional<z.ZodBoolean>;
    offline: z.ZodOptional<z.ZodBoolean>;
    disableThinking: z.ZodOptional<z.ZodBoolean>;
    quantized: z.ZodOptional<z.ZodBoolean>;
    cacheDir: z.ZodOptional<z.ZodString>;
    circuitBreaker: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        failureThreshold: z.ZodOptional<z.ZodNumber>;
        resetTimeoutMs: z.ZodOptional<z.ZodNumber>;
        successThreshold: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type LMSettingsShape = {
    [K in keyof typeof lmSettingsShape]: z.infer<(typeof lmSettingsShape)[K]>;
};
//# sourceMappingURL=lm-schema.d.ts.map