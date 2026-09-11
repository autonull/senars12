import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { transformersJS } from '@browser-ai/transformers-js';
import type { LMTask } from '@senars/util';
import { createProviderRegistry, customProvider, type LanguageModel } from 'ai';
import { createMockLanguageModel } from './lm-service.js';

export type { LMTask } from '@senars/util';

export const BUILTIN_CHAT_MODEL = process.env.LM_MODEL ?? 'onnx-community/Qwen2.5-1.5B-Instruct';
export const BUILTIN_COMPACT_MODEL =
  process.env.LM_COMPACT_MODEL ?? 'HuggingFaceTB/SmolLM2-360M-Instruct';

const OLLAMA_DEFAULT_HOST = 'http://localhost:11434/v1';
const OLLAMA_QUALITY_DEFAULT = process.env.LM_MODEL ?? 'llama3.1:8b';
const OLLAMA_FAST_DEFAULT = 'llama3.2:3b';
const OLLAMA_COMPACT_DEFAULT = 'phi3:3.8b';

export type LMProviderName =
  | 'transformers'
  | 'ollama'
  | 'anthropic'
  | 'openai'
  | 'openai-compatible'
  | 'mock';

export function getLmProvider(): LMProviderName {
  const env = (
    process.env.LM_PROVIDER ??
    process.env.SENARS_LM_PROVIDER ??
    'transformers'
  ).toLowerCase();
  if (
    env === 'ollama' ||
    env === 'transformers' ||
    env === 'mock' ||
    env === 'anthropic' ||
    env === 'openai' ||
    env === 'openai-compatible'
  )
    return env as LMProviderName;
  return 'transformers';
}

const localModel = (model: string): LanguageModel => transformersJS(model, { device: 'cpu' });
const mockModel = (): LanguageModel => createMockLanguageModel() as unknown as LanguageModel;

export function createSeNARSRegistry() {
  const provider = getLmProvider();
  const hasCloudKey = Boolean(
    process.env.LM_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? process.env.OPENAI_API_KEY
  );
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
    baseURL: process.env.OLLAMA_HOST ? `${process.env.OLLAMA_HOST}/v1` : OLLAMA_DEFAULT_HOST,
  });
  const cloud = createOpenAICompatible({
    name: 'cloud',
    apiKey:
      process.env.LM_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? process.env.OPENAI_API_KEY ?? '',
    baseURL:
      process.env.LM_BASE_URL ??
      (provider === 'anthropic' ? 'https://api.anthropic.com/v1' : 'https://api.openai.com/v1'),
  });
  const cloudModel = process.env.LM_MODEL ?? 'claude-3-5-sonnet-latest';
  const openaiModel = process.env.LM_MODEL ?? 'gpt-4o-mini';
  const frontierDefault = provider === 'openai' ? openaiModel : cloudModel;
  const frontierId = process.env.LM_MODEL ?? frontierDefault;

  return createProviderRegistry({
    cloud: customProvider({
      languageModels: {
        quality: useCloud ? cloud(frontierId) : mockModel(),
        fast: useCloud ? cloud(process.env.LM_FAST_MODEL ?? frontierId) : mockModel(),
        structured: useCloud ? cloud(process.env.LM_STRUCTURED_MODEL ?? frontierId) : mockModel(),
      },
      fallbackProvider: useCloud ? cloud : undefined,
    }),
    local: customProvider({
      languageModels: {
        quality: useLocal ? ollama(process.env.LM_MODEL ?? OLLAMA_QUALITY_DEFAULT) : mockModel(),
        fast: useLocal ? ollama(OLLAMA_FAST_DEFAULT) : mockModel(),
        compact: useLocal ? ollama(OLLAMA_COMPACT_DEFAULT) : mockModel(),
      },
      fallbackProvider: useLocal ? ollama : undefined,
    }),
    builtin: customProvider({
      languageModels: {
        quality: localModel(BUILTIN_CHAT_MODEL),
        fast: localModel(BUILTIN_COMPACT_MODEL),
        structured: localModel(BUILTIN_COMPACT_MODEL),
        compact: localModel(BUILTIN_COMPACT_MODEL),
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

export function getModelForTask(registry: SeNARSRegistry, task: LMTask): LanguageModel {
  const chain = getModelChain(getLmProvider(), task);
  for (const id of chain) {
    try {
      return registry.languageModel(id);
    } catch {}
  }
  throw new Error(`No model available for task: ${task}`);
}

export function getQualityModel(registry: SeNARSRegistry): LanguageModel {
  return getModelForTask(registry, 'quality');
}

export const hasCloudCredentials = (): boolean =>
  Boolean(process.env.LM_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? process.env.OPENAI_API_KEY);

export async function probeOllama(host?: string): Promise<boolean> {
  const base = (host ?? process.env.OLLAMA_HOST ?? 'http://localhost:11434').replace(
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
