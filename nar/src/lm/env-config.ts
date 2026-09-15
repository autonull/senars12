import type { LMProviderName } from './providers.js';

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
  /** Named preset: auto | cloud-quality | local-private | ollama. */
  profile?: string;
  fastModel?: string;
  structuredModel?: string;
  compactModel?: string;
  /** Cloud base URL (openai-compatible endpoints). */
  baseUrl?: string;
  ollamaHost?: string;
  /** Env var name holding the cloud API key. */
  apiKeyEnv?: string;
  quantized?: boolean;
  cacheDir?: string;
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
  'ollama',
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

const credentialEnvFor = (provider: LMProviderName): string | undefined =>
  CLOUD_CREDENTIALS.find(([p]) => p === provider)?.[1];

/**
 * LM_PROFILE presets. `production` is reserved (handled by lifecycle config merge).
 */
export const LM_PROFILES = ['auto', 'cloud-quality', 'local-private', 'ollama'] as const;
export type LMProfileName = (typeof LM_PROFILES)[number];

const resolveProfileProvider = (profile: string): LMProviderName | undefined => {
  switch (profile) {
    case 'cloud-quality':
      return detectCloudProvider() ?? 'transformers';
    case 'local-private':
      return 'transformers';
    case 'ollama':
      return 'ollama';
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
  const rawProvider = (explicit ?? profileProvider ?? detectCloudProvider() ?? 'transformers')
    .toString()
    .toLowerCase();
  if (!isResolvedProvider(rawProvider)) {
    throw new Error(
      `Invalid LM provider "${rawProvider}". Must be one of: ${PROVIDERS.join(', ')}.`
    );
  }
  const provider = rawProvider;
  const cloudCredentialEnv = CLOUD_CREDENTIALS.find(([p]) => p === provider)?.[1] ?? undefined;
  return {
    provider,
    profile: profile && profile !== 'production' ? profile : undefined,
    model: env('LM_MODEL', 'SENARS_LM_MODEL') ?? file?.model,
    fastModel: env('LM_FAST_MODEL') ?? file?.fastModel,
    structuredModel: env('LM_STRUCTURED_MODEL') ?? file?.structuredModel,
    compactModel: env('LM_COMPACT_MODEL') ?? file?.compactModel,
    baseUrl: env('LM_BASE_URL') ?? file?.baseUrl,
    ollamaHost: env('OLLAMA_HOST') ?? file?.ollamaHost,
    apiKeyEnv: file?.apiKeyEnv ?? cloudCredentialEnv,
    quantized: file?.quantized,
    cacheDir: file?.cacheDir,
    disableThinking: ['1', 'true'].includes(env('LM_DISABLE_THINKING') ?? '') || file?.disableThinking === true,
    circuitBreaker: file?.circuitBreaker,
  };
};

/** Default per-provider model when none is configured. */
export const defaultModelFor = (provider: ResolvedProvider): string => {
  switch (provider) {
    case 'ollama':
      return env('OLLAMA_MODEL') ?? 'llama3.2';
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
  const host =
    s.provider === 'ollama'
      ? (s.ollamaHost ?? 'http://localhost:11434')
      : s.provider === 'openai-compatible'
        ? (s.baseUrl ?? '')
        : undefined;
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
