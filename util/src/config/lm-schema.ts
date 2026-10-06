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
