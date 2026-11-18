import { z } from 'zod';
import { positiveInt } from './boundary.js';
/**
 * Canonical field shape for LM settings — shared by @senars/nar/lm (LMSettings),
 * src/config (senars.config.json `lm` block), and tooling/config UIs.
 * Exported as a raw shape so consumers compose it with their own zod version.
 */
export const lmSettingsShape = {
  provider: z.string().optional(),
  /** Named preset: auto | cloud-quality | local-private | ollama. */
  profile: z.string().optional(),
  model: z.string().optional(),
  fastModel: z.string().optional(),
  structuredModel: z.string().optional(),
  compactModel: z.string().optional(),
  baseUrl: z.string().optional(),
  ollamaHost: z.string().optional(),
  apiKeyEnv: z.string().optional(),
  /** llama.cpp server host (llama-server native API). */
  llamacppHost: z.string().optional(),
  /** Embedded llama.cpp: path to a GGUF model file. */
  llamacppModelPath: z.string().optional(),
  /** Embedded llama.cpp: GPU backend (`auto` | `cuda` | `metal` | `vulkan` | `false`). */
  llamacppGpu: z.union([z.enum(['auto', 'cuda', 'metal', 'vulkan']), z.literal(false)]).optional(),
  /** Embedded llama.cpp: layers to offload (`max` or a count). */
  llamacppGpuLayers: z.union([z.number(), z.literal('max')]).optional(),
  /** Embedded llama.cpp: context window size. */
  llamacppContextSize: z.number().optional(),
  /** Embedded llama.cpp: batch size. */
  llamacppBatchSize: z.number().optional(),
  /** Embedded llama.cpp: parallel sequences. */
  llamacppSequences: z.number().optional(),
  /** Embedded llama.cpp: flash attention. */
  llamacppFlashAttention: z.boolean().optional(),
  /** Hard offline switch — never probe or reach the network. */
  offline: z.boolean().optional(),
  /** Disable thinking-model reasoning traces (Qwen3 etc.). */
  disableThinking: z.boolean().optional(),
  quantized: z.boolean().optional(),
  cacheDir: z.string().optional(),
  /** Per-provider circuit breaker settings. */
  circuitBreaker: z
    .record(
      z.string(),
      z.object({
        failureThreshold: positiveInt.optional(),
        resetTimeoutMs: positiveInt.optional(),
        successThreshold: positiveInt.optional(),
      })
    )
    .optional(),
} as const;

/** Canonical LM settings schema (composed from the raw shape). */
export const lmSettingsSchema = z.object(lmSettingsShape);

export type LMSettingsShape = {
  [K in keyof typeof lmSettingsShape]: z.infer<(typeof lmSettingsShape)[K]>;
};
