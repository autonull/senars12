import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { transformersJS } from '@browser-ai/transformers-js';
import type { LMTask } from '@senars/util';
import { createProviderRegistry, customProvider, type LanguageModel } from 'ai';
import {
  builtinModels,
  defaultModelFor,
  type LMSettings,
  type LMSettingsInput,
  resolveLMSettings,
} from './env-config.js';
import { createMockLanguageModel } from './lm-service.js';

export type { LMTask } from '@senars/util';
export type { LMSettings } from './env-config.js';

const OLLAMA_HOST_DEFAULT = 'http://localhost:11434';
const OLLAMA_FAST_DEFAULT = 'llama3.2:3b';
const OLLAMA_COMPACT_DEFAULT = 'phi3:3.8b';

export type LMProviderName =
  | 'transformers'
  | 'ollama'
  | 'anthropic'
  | 'openai'
  | 'openai-compatible'
  | 'mock';

let activeFileSettings: LMSettingsInput | undefined;

/** Install file/config-derived settings (env still wins at read time). */
export const configureLM = (settings: LMSettingsInput): void => {
  activeFileSettings = settings;
};

/** Active settings, lazily resolved from env (+ anything installed via configureLM). */
export const getLMSettings = (): LMSettings => resolveLMSettings(activeFileSettings);

export const getLmProvider = (): LMProviderName => getLMSettings().provider;

const localModel = (model: string, settings: LMSettings): LanguageModel =>
  transformersJS(model, {
    device: 'cpu',
    dtype: settings.quantized ? 'q4' : 'fp32',
    ...(settings.cacheDir ? { cacheDir: settings.cacheDir } : {}),
  } as Parameters<typeof transformersJS>[1]);
const mockModel = (): LanguageModel => createMockLanguageModel() as unknown as LanguageModel;

const cloudApiKey = (settings: LMSettings): string | undefined => {
  const viaEnvName = settings.apiKeyEnv ? process.env[settings.apiKeyEnv] : undefined;
  return (
    viaEnvName ??
    process.env.LM_API_KEY ??
    process.env.ANTHROPIC_API_KEY ??
    process.env.OPENAI_API_KEY
  );
};

export function createSeNARSRegistry(settings?: LMSettings) {
  const s = settings ?? getLMSettings();
  const {
    provider,
    model: modelOverride,
    fastModel,
    structuredModel,
    compactModel,
    baseUrl,
    ollamaHost,
  } = s;

  const hasCloudKey = Boolean(cloudApiKey(s));
  const useCloud =
    (provider === 'anthropic' || provider === 'openai' || provider === 'openai-compatible') &&
    hasCloudKey;
  const useLocal =
    provider === 'ollama' ||
    provider === 'anthropic' ||
    provider === 'openai' ||
    provider === 'openai-compatible';

  const ollama = createOpenAICompatible({
    name: 'ollama',
    apiKey: 'ollama',
    baseURL: `${(ollamaHost ?? OLLAMA_HOST_DEFAULT).replace(/\/v1\/?$/, '')}/v1`,
  });
  const cloud = createOpenAICompatible({
    name: 'cloud',
    apiKey: cloudApiKey(s) ?? '',
    baseURL:
      baseUrl ??
      (provider === 'anthropic' ? 'https://api.anthropic.com/v1' : 'https://api.openai.com/v1'),
  });
  const frontierId = modelOverride ?? defaultModelFor(provider);
  const builtinCompact = compactModel ?? builtinModels.compact;

  return createProviderRegistry({
    cloud: customProvider({
      languageModels: {
        quality: useCloud ? cloud(frontierId) : mockModel(),
        fast: useCloud ? cloud(fastModel ?? frontierId) : mockModel(),
        structured: useCloud ? cloud(structuredModel ?? frontierId) : mockModel(),
      },
      fallbackProvider: useCloud ? cloud : undefined,
    }),
    local: customProvider({
      languageModels: {
        quality: useLocal ? ollama(modelOverride ?? defaultModelFor('ollama')) : mockModel(),
        fast: useLocal ? ollama(fastModel ?? OLLAMA_FAST_DEFAULT) : mockModel(),
        compact: useLocal ? ollama(compactModel ?? OLLAMA_COMPACT_DEFAULT) : mockModel(),
      },
      fallbackProvider: useLocal ? ollama : undefined,
    }),
    builtin: customProvider({
      languageModels: {
        quality: localModel(modelOverride ?? builtinModels.quality, s),
        fast: localModel(builtinCompact, s),
        structured: localModel(builtinCompact, s),
        compact: localModel(builtinCompact, s),
        mock: mockModel(),
      },
    }),
  });
}

export type SeNARSRegistry = ReturnType<typeof createSeNARSRegistry>;
export type SeNARSModelId = Parameters<SeNARSRegistry['languageModel']>[0];

const CHAINS: Record<LMProviderName, Record<LMTask, SeNARSModelId[]>> = {
  transformers: {
    quality: ['builtin:quality'],
    fast: ['builtin:fast'],
    structured: ['builtin:structured'],
  },
  mock: {
    quality: ['builtin:mock'],
    fast: ['builtin:mock'],
    structured: ['builtin:mock'],
  },
  ollama: {
    quality: ['local:quality', 'builtin:quality', 'builtin:compact', 'builtin:mock'],
    fast: ['local:fast', 'builtin:compact', 'builtin:mock'],
    structured: ['local:quality', 'builtin:compact', 'builtin:mock'],
  },
  anthropic: {
    quality: ['cloud:quality', 'local:quality', 'builtin:quality', 'builtin:mock'],
    fast: ['cloud:fast', 'local:fast', 'builtin:compact', 'builtin:mock'],
    structured: ['cloud:structured', 'local:quality', 'builtin:compact', 'builtin:mock'],
  },
  openai: {
    quality: ['cloud:quality', 'local:quality', 'builtin:quality', 'builtin:mock'],
    fast: ['cloud:fast', 'local:fast', 'builtin:compact', 'builtin:mock'],
    structured: ['cloud:structured', 'local:quality', 'builtin:compact', 'builtin:mock'],
  },
  'openai-compatible': {
    quality: ['cloud:quality', 'local:quality', 'builtin:quality', 'builtin:mock'],
    fast: ['cloud:fast', 'local:fast', 'builtin:compact', 'builtin:mock'],
    structured: ['cloud:structured', 'local:quality', 'builtin:compact', 'builtin:mock'],
  },
};

export function getModelChain(provider: LMProviderName, task: LMTask): SeNARSModelId[] {
  return CHAINS[provider][task];
}

export function getModelForTask(
  registry: SeNARSRegistry,
  task: LMTask,
  settings?: LMSettings
): LanguageModel {
  for (const id of getModelChain(settings?.provider ?? getLmProvider(), task)) {
    try {
      return registry.languageModel(id);
    } catch {}
  }
  throw new Error(`No model available for task: ${task}`);
}

export function getQualityModel(registry: SeNARSRegistry): LanguageModel {
  return getModelForTask(registry, 'quality');
}

export const hasCloudCredentials = (settings?: LMSettings): boolean =>
  Boolean(cloudApiKey(settings ?? getLMSettings()));

export async function probeOllama(host?: string): Promise<boolean> {
  const base = (host ?? getLMSettings().ollamaHost ?? 'http://localhost:11434').replace(
    /\/v1\/?$/,
    ''
  );
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1500);
    const res = await fetch(`${base}/api/tags`, { signal: ctl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

export async function resolveActiveProvider(): Promise<LMProviderName> {
  const configured = getLmProvider();
  if (configured === 'mock') return 'mock';
  if (configured === 'transformers') {
    if (hasCloudCredentials()) return 'openai-compatible';
    return (await probeOllama()) ? 'ollama' : 'transformers';
  }
  if (configured === 'ollama') return (await probeOllama()) ? 'ollama' : 'transformers';
  return hasCloudCredentials() ? configured : (await probeOllama()) ? 'ollama' : 'transformers';
}
