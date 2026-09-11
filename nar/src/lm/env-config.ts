import type { LMProviderName } from './providers.js';

export type ResolvedProvider = LMProviderName;

/**
 * Canonical LM settings — the single source of truth for all LM configuration.
 * Precedence: environment variables > file config (senars.config.json) > defaults.
 */
export interface LMSettings {
  provider: LMProviderName;
  /** Quality/frontier model id (per-provider default when omitted). */
  model?: string;
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
 * Resolve LM settings from env + optional file config. Throws on invalid provider.
 */
export const resolveLMSettings = (file?: LMSettingsInput): LMSettings => {
  const rawProvider = (env('LM_PROVIDER', 'SENARS_LM_PROVIDER') ?? file?.provider ?? 'transformers')
    .toString()
    .toLowerCase();
  if (!isResolvedProvider(rawProvider)) {
    throw new Error(
      `Invalid LM provider "${rawProvider}". Must be one of: ${PROVIDERS.join(', ')}.`
    );
  }
  const provider = rawProvider;
  return {
    provider,
    model: env('LM_MODEL', 'SENARS_LM_MODEL') ?? file?.model,
    fastModel: env('LM_FAST_MODEL') ?? file?.fastModel,
    structuredModel: env('LM_STRUCTURED_MODEL') ?? file?.structuredModel,
    compactModel: env('LM_COMPACT_MODEL') ?? file?.compactModel,
    baseUrl: env('LM_BASE_URL') ?? file?.baseUrl,
    ollamaHost: env('OLLAMA_HOST') ?? file?.ollamaHost,
    apiKeyEnv: file?.apiKeyEnv,
    quantized: file?.quantized,
    cacheDir: file?.cacheDir,
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
