import { existsSync } from 'node:fs';

export const LM_PROVIDER_NAMES = [
  'transformers',
  'llamacpp',
  'llamacpp-embedded',
  'anthropic',
  'openai',
  'openai-compatible',
  'webllm',
  'mock',
] as const;

export type LMProviderName = (typeof LM_PROVIDER_NAMES)[number];

export type ResolvedProvider = LMProviderName;

/**
 * Canonical LM settings — the single source of truth for all LM configuration.
 * Precedence: environment variables > file config (senars.config.json) > defaults.
 */
export interface CircuitBreakerConfig {
  /** Failures before opening the circuit. */
  failureThreshold: number;
  /** Time in ms before attempting half-open. */
  resetTimeoutMs: number;
  /** Successful calls in half-open before closing. */
  successThreshold: number;
}

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
  llamacppGpu?: 'auto' | 'cuda' | 'metal' | 'vulkan' | false;
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
  circuitBreaker?: Partial<Record<LMProviderName, Partial<CircuitBreakerConfig>>>;
}

export interface ResolvedLMConfig {
  provider: ResolvedProvider;
  model: string;
  host?: string;
}

const TRANSFORMERS_DEFAULT_MODEL = 'onnx-community/Qwen2.5-1.5B-Instruct';
const TRANSFORMERS_DEFAULT_COMPACT = 'HuggingFaceTB/SmolLM2-360M-Instruct';

const PROVIDERS: readonly ResolvedProvider[] = [
  'transformers',
  'llamacpp',
  'llamacpp-embedded',
  'mock',
  'anthropic',
  'openai',
  'openai-compatible',
];

const isResolvedProvider = (v: string): v is ResolvedProvider =>
  (PROVIDERS as readonly string[]).includes(v);

const env = (...keys: string[]): string | undefined =>
  keys.map((k) => process.env[k]).find((v) => v !== undefined && v !== '');

/** File/config-facing settings: provider may be any string (validated at resolve time). */
export type LMSettingsInput = Omit<Partial<LMSettings>, 'provider'> & { provider?: string };

/**
 * Cloud provider presets with their credential env vars, in preference order.
 */
const CLOUD_CREDENTIALS: readonly (readonly [LMProviderName, string])[] = [
  ['anthropic', 'ANTHROPIC_API_KEY'],
  ['openai', 'OPENAI_API_KEY'],
];

/** First cloud provider with a credential present in the environment. */
export const detectCloudProvider = (): LMProviderName | undefined =>
  CLOUD_CREDENTIALS.find(([, key]) => Boolean(process.env[key]))?.[0];

/** Sync cheap check: an embedded-llama GGUF model is configured and present on disk. */
export const embeddedLlamaConfigured = (): boolean => {
  const p = process.env.LM_LLAMACPP_MODEL;
  return Boolean(p && existsSync(p));
};

/** Speed-first local default: embedded llama.cpp when a GGUF is present, else the
 *  external llama-server when configured, else mock (symbolic fallbacks cover cognition).
 *  transformers.js is explicit opt-in only (LM_PROVIDER=transformers) — never the default. */
export const defaultLocalProvider = (): LMProviderName => {
  if (embeddedLlamaConfigured()) return 'llamacpp-embedded';
  if (process.env.LM_LLAMACPP_HOST) return 'llamacpp';
  return 'mock';
};

const _credentialEnvFor = (provider: LMProviderName): string | undefined =>
  CLOUD_CREDENTIALS.find(([p]) => p === provider)?.[1];

/**
 * LM_PROFILE presets. `production` is reserved (handled by lifecycle config merge).
 */
export const LM_PROFILES = ['auto', 'cloud-quality', 'local-private', 'ollama'] as const;
export type LMProfileName = (typeof LM_PROFILES)[number];

const resolveProfileProvider = (profile: string): LMProviderName | undefined => {
  switch (profile) {
    case 'cloud-quality':
      return detectCloudProvider() ?? defaultLocalProvider();
    case 'local-private':
      return defaultLocalProvider();
    case 'ollama':
      return 'openai-compatible';
    default:
      return undefined;
  }
};

/**
 * Resolve LM settings from env + optional file config. Throws on invalid provider.
 * Precedence: LM_PROVIDER > file provider > LM_PROFILE preset > auto-detect
 * (cloud when credentials exist, else local transformers).
 */
export const resolveLMSettings = (file?: LMSettingsInput): LMSettings => {
  const explicit = env('LM_PROVIDER', 'SENARS_LM_PROVIDER') ?? file?.provider;
  const profile = env('LM_PROFILE') ?? file?.profile;
  const profileProvider =
    profile && profile !== 'production' ? resolveProfileProvider(profile) : undefined;
  const rawProvider = (
    explicit ??
    profileProvider ??
    detectCloudProvider() ??
    defaultLocalProvider()
  )
    .toString()
    .toLowerCase();
  // A4 deprecation: 'ollama' is an alias for openai-compatible pointed at the
  // local daemon. Resolved at the settings boundary; nothing downstream sees it.
  const aliasedOllama = rawProvider === 'ollama' || profile === 'ollama';
  const normalized = aliasedOllama && rawProvider === 'ollama' ? 'openai-compatible' : rawProvider;
  if (!isResolvedProvider(normalized)) {
    throw new Error(
      `Invalid LM provider "${rawProvider}". Must be one of: ${PROVIDERS.join(', ')}.` +
        (rawProvider === 'ollama' ? " ('ollama' is now LM_PROVIDER=openai-compatible)" : '')
    );
  }
  const provider = normalized as LMProviderName;
  const cloudCredentialEnv = CLOUD_CREDENTIALS.find(([p]) => p === provider)?.[1] ?? undefined;
  return {
    provider,
    profile: profile && profile !== 'production' ? profile : undefined,
    fastModel: env('LM_FAST_MODEL') ?? file?.fastModel,
    structuredModel: env('LM_STRUCTURED_MODEL') ?? file?.structuredModel,
    compactModel: env('LM_COMPACT_MODEL') ?? file?.compactModel,
    baseUrl:
      env('LM_BASE_URL') ??
      file?.baseUrl ??
      (aliasedOllama
        ? `${(env('OLLAMA_HOST') ?? file?.ollamaHost ?? 'http://localhost:11434').replace(/\/?$/, '')}/v1`
        : undefined),
    ollamaHost: env('OLLAMA_HOST') ?? file?.ollamaHost,
    model:
      env('LM_MODEL', 'SENARS_LM_MODEL') ??
      file?.model ??
      (aliasedOllama ? (env('OLLAMA_MODEL') ?? 'llama3.2') : undefined),
    llamacppHost: env('LM_LLAMACPP_HOST') ?? file?.llamacppHost,
    llamacppModelPath: env('LM_LLAMACPP_MODEL') ?? file?.llamacppModelPath,
    llamacppGpu:
      (env('LM_LLAMACPP_GPU') as 'auto' | 'cuda' | 'metal' | 'vulkan' | false) ?? file?.llamacppGpu,
    llamacppGpuLayers:
      (env('LM_LLAMACPP_GPU_LAYERS') ? Number(env('LM_LLAMACPP_GPU_LAYERS')) : undefined) ??
      file?.llamacppGpuLayers,
    llamacppContextSize: env('LM_LLAMACPP_CTX')
      ? Number(env('LM_LLAMACPP_CTX'))
      : file?.llamacppContextSize,
    llamacppBatchSize: env('LM_LLAMACPP_BATCH')
      ? Number(env('LM_LLAMACPP_BATCH'))
      : file?.llamacppBatchSize,
    llamacppSequences: env('LM_LLAMACPP_SEQS')
      ? Number(env('LM_LLAMACPP_SEQS'))
      : file?.llamacppSequences,
    // D7-adjacent: FA default true (KV-cache padding path without it is
    // segv-prone on hybrid-attention models); an explicit env value wins.
    llamacppFlashAttention:
      env('LM_LLAMACPP_FLASH_ATTN') !== undefined
        ? ['1', 'true'].includes(env('LM_LLAMACPP_FLASH_ATTN') ?? '')
        : (file?.llamacppFlashAttention ?? true),
    apiKeyEnv: file?.apiKeyEnv ?? cloudCredentialEnv,
    quantized: file?.quantized,
    cacheDir: file?.cacheDir,
    offline: ['1', 'true'].includes(env('LM_OFFLINE') ?? '') || file?.offline === true,
    dtype: (env('LM_DTYPE') as LMSettings['dtype'] | undefined) ?? file?.dtype,
    qualityDtype:
      (env('LM_QUALITY_DTYPE') as LMSettings['qualityDtype'] | undefined) ?? file?.qualityDtype,
    fastDtype: (env('LM_FAST_DTYPE') as LMSettings['fastDtype'] | undefined) ?? file?.fastDtype,
    disableThinking:
      ['1', 'true'].includes(env('LM_DISABLE_THINKING') ?? '') || file?.disableThinking === true,
    circuitBreaker: file?.circuitBreaker,
  };
};

/** Default per-provider model when none is configured. */
export const defaultModelFor = (provider: ResolvedProvider): string => {
  switch (provider) {
    case 'llamacpp':
      return env('LM_MODEL') ?? 'local-model';
    case 'llamacpp-embedded':
      return env('LM_LLAMACPP_MODEL') ?? 'local-model';
    case 'transformers':
      return TRANSFORMERS_DEFAULT_MODEL;
    case 'anthropic':
      return 'claude-3-5-sonnet-latest';
    case 'openai':
      return 'gpt-4o-mini';
    case 'openai-compatible':
      return 'default';
    case 'webllm':
      return 'llama-3.2-3b-instruct';
    case 'mock':
      return 'mock';
  }
};

export const resolveLMConfig = (file?: LMSettingsInput): ResolvedLMConfig => {
  const s = resolveLMSettings(file);
  const model = s.model ?? defaultModelFor(s.provider);
  const host = s.provider === 'openai-compatible' ? (s.baseUrl ?? '') : undefined;
  return { provider: s.provider, model, host };
};

export const formatLMConfig = (cfg: ResolvedLMConfig): string => {
  const lines = [`provider: ${cfg.provider}`, `model:    ${cfg.model}`];
  if (cfg.host) lines.push(`host:     ${cfg.host}`);
  return lines.join('\n');
};

export const builtinModels = {
  quality: TRANSFORMERS_DEFAULT_MODEL,
  compact: TRANSFORMERS_DEFAULT_COMPACT,
};
