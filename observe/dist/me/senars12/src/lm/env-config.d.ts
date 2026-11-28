import type { CircuitBreakerSettings, CircuitState } from '@senars/util/circuit-breaker';
import { type GpuSetting } from './runtime/llama-runtime';
export type { CircuitState };
export declare const LM_PROVIDER_NAMES: readonly ['transformers', 'llamacpp', 'llamacpp-embedded', 'anthropic', 'openai', 'openai-compatible', 'webllm', 'mock'];
export type LMProviderName = (typeof LM_PROVIDER_NAMES)[number];
export type ResolvedProvider = LMProviderName;
/**
 * Canonical LM settings — the single source of truth for all LM configuration.
 * Precedence: environment variables > file config (senars.config.json) > defaults.
 */
export interface LMSettings {
    provider: LMProviderName;
    /** Quality/frontier model id (per-provider default when omitted). */
    model?: string;
    /** Named preset: auto | cloud-quality | local-private | ollama (deprecated alias). */
    profile?: string;
    fastModel?: string;
    structuredModel?: string;
    compactModel?: string;
    /** Cloud base URL (openai-compatible endpoints). */
    baseUrl?: string;
    ollamaHost?: string;
    /** llama.cpp server host (llama-server native API). */
    llamacppHost?: string;
    /** Embedded llama.cpp: path to GGUF model file. */
    llamacppModelPath?: string;
    /** Embedded llama.cpp: GPU backend (auto | cuda | metal | vulkan | false). */
    llamacppGpu?: GpuSetting;
    /** Embedded llama.cpp: GPU layers to offload (number | 'max'). */
    llamacppGpuLayers?: number | 'max';
    /** Embedded llama.cpp: context window size. */
    llamacppContextSize?: number;
    /** Embedded llama.cpp: batch size. */
    llamacppBatchSize?: number;
    /** Embedded llama.cpp: parallel sequences. */
    llamacppSequences?: number;
    /** Embedded llama.cpp: enable flash attention. */
    llamacppFlashAttention?: boolean;
    /** Env var name holding the cloud API key. */
    apiKeyEnv?: string;
    quantized?: boolean;
    cacheDir?: string;
    /** H4: hard offline switch — never probe or reach the network (cloud/remote disabled). */
    offline?: boolean;
    /** H7: dtype/device matrix — global override, then per-slot (quality/fast). */
    dtype?: 'q4' | 'q8' | 'fp16' | 'fp32';
    qualityDtype?: 'q4' | 'q8' | 'fp16' | 'fp32';
    fastDtype?: 'q4' | 'q8' | 'fp16' | 'fp32';
    /** Inject chat_template_kwargs {enable_thinking:false} per request (Qwen3 reasoning models via llama.cpp). */
    disableThinking?: boolean;
    /** Per-provider circuit breaker settings. */
    circuitBreaker?: Partial<Record<LMProviderName, Partial<CircuitBreakerSettings>>>;
}
export interface ResolvedLMConfig {
    provider: ResolvedProvider;
    model: string;
    host?: string;
}
/**
 * The cloud credential: the env var named by `apiKeyEnv` (if any), then the
 * generic key, then the provider-specific cloud keys.
 */
export declare const cloudApiKey: (apiKeyEnv?: string) => string | undefined;
/** File/config-facing settings: provider may be any string (validated at resolve time). */
export type LMSettingsInput = Omit<Partial<LMSettings>, 'provider'> & {
    provider?: string;
};
/** First cloud provider with a credential present in the environment. */
export declare const detectCloudProvider: () => LMProviderName | undefined;
/** Sync cheap check: an embedded-llama GGUF model is configured and present on disk. */
export declare const embeddedLlamaConfigured: () => boolean;
/** Speed-first local default: embedded llama.cpp when a GGUF is present, else the
 *  external llama-server when configured, else mock (symbolic fallbacks cover cognition).
 *  transformers.js is explicit opt-in only (LM_PROVIDER=transformers) — never the default. */
export declare const defaultLocalProvider: () => LMProviderName;
/**
 * LM_PROFILE presets. `production` is reserved (handled by lifecycle config merge).
 */
export declare const LM_PROFILES: readonly ['auto', 'cloud-quality', 'local-private', 'ollama'];
export type LMProfileName = (typeof LM_PROFILES)[number];
/**
 * Resolve LM settings from env + optional file config. Throws on invalid provider.
 * Precedence: LM_PROVIDER > file provider > LM_PROFILE preset > auto-detect
 * (cloud when credentials exist, else local transformers).
 */
export declare const resolveLMSettings: (file?: LMSettingsInput) => LMSettings;
/** Default per-provider model when none is configured. */
export declare const defaultModelFor: (provider: ResolvedProvider) => string;
export declare const resolveLMConfig: (file?: LMSettingsInput) => ResolvedLMConfig;
export declare const formatLMConfig: (cfg: ResolvedLMConfig) => string;
export declare const builtinModels: {
    quality: string;
    compact: string;
};
//# sourceMappingURL=env-config.d.ts.map