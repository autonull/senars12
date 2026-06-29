import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { transformersJS } from '@browser-ai/transformers-js';
import { createProviderRegistry, customProvider } from 'ai';
import { createMockLanguageModel } from './lm-service.js';

export const BUILTIN_CHAT_MODEL = 'HuggingFaceTB/SmolLM2-135M-Instruct';
export const BUILTIN_COMPACT_MODEL = 'Xenova/gpt-2';

const OLLAMA_DEFAULT_HOST = 'http://localhost:11434/v1';
const OLLAMA_QUALITY_DEFAULT = 'llama3.1:8b';
const OLLAMA_FAST_DEFAULT = 'llama3.2:3b';
const OLLAMA_COMPACT_DEFAULT = 'phi3:3.8b';

const ollama = createOpenAICompatible({
  name: 'ollama',
  apiKey: 'ollama',
  baseURL: process.env.OLLAMA_HOST ? `${process.env.OLLAMA_HOST}/v1` : OLLAMA_DEFAULT_HOST,
});

export type LMTask = 'quality' | 'fast' | 'structured';

function getLmProvider(): 'ollama' | 'transformers' | 'mock' {
  const env = (process.env.LM_PROVIDER ?? 'transformers').toLowerCase();
  if (env === 'ollama' || env === 'transformers' || env === 'mock') return env;
  return 'transformers';
}

export function createSeNARSRegistry() {
  const provider = getLmProvider();

  if (provider === 'mock') {
    return createProviderRegistry({
      builtin: customProvider({
        languageModels: {
          quality: createMockLanguageModel() as any,
          fast: createMockLanguageModel() as any,
          structured: createMockLanguageModel() as any,
        },
      }),
    });
  }

  if (provider === 'transformers') {
    return createProviderRegistry({
      builtin: customProvider({
        languageModels: {
          quality: transformersJS(BUILTIN_CHAT_MODEL, { device: 'cpu' }) as any,
          fast: transformersJS(BUILTIN_COMPACT_MODEL, { device: 'cpu' }) as any,
          structured: transformersJS(BUILTIN_COMPACT_MODEL, { device: 'cpu' }) as any,
        },
      }),
    });
  }

  // ollama
  return createProviderRegistry({
    local: customProvider({
      languageModels: {
        quality: ollama(process.env.LM_MODEL ?? OLLAMA_QUALITY_DEFAULT) as any,
        fast: ollama(OLLAMA_FAST_DEFAULT) as any,
        compact: ollama(OLLAMA_COMPACT_DEFAULT) as any,
      },
      fallbackProvider: ollama,
    }),
    builtin: customProvider({
      languageModels: {
        quality: transformersJS(BUILTIN_CHAT_MODEL, { device: 'cpu' }) as any,
        compact: transformersJS(BUILTIN_COMPACT_MODEL, { device: 'cpu' }) as any,
        mock: createMockLanguageModel() as any,
      },
    }),
  });
}

export type SeNARSRegistry = ReturnType<typeof createSeNARSRegistry>;

export function getModelForTask(registry: SeNARSRegistry, task: LMTask): any {
  const provider = getLmProvider();
  const mockChain = {
    quality: ['builtin:quality'],
    fast: ['builtin:fast'],
    structured: ['builtin:structured'],
  };
  const transformersChain = {
    quality: ['builtin:quality'],
    fast: ['builtin:fast'],
    structured: ['builtin:structured'],
  };
  const ollamaChain: Record<LMTask, string[]> = {
    quality: ['local:quality', 'builtin:quality', 'builtin:compact', 'builtin:mock'],
    fast: ['local:fast', 'builtin:compact', 'builtin:mock'],
    structured: ['local:quality', 'builtin:compact', 'builtin:mock'],
  };
  const chain =
    provider === 'ollama' ? ollamaChain : provider === 'mock' ? mockChain : transformersChain;

  for (const id of chain[task]) {
    try {
      return registry.languageModel(id as any);
    } catch {
      continue;
    }
  }
  throw new Error(`No model available for task: ${task}`);
}

export function getQualityModel(registry: SeNARSRegistry): any {
  return getModelForTask(registry, 'quality');
}
