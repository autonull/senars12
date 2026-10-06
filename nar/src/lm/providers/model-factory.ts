import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModelV3, LanguageModelV3CallOptions } from '@ai-sdk/provider';
import { transformersJS } from '@browser-ai/transformers-js';
import {
  createProviderRegistry,
  customProvider,
  type LanguageModel,
  type LanguageModelMiddleware,
  wrapLanguageModel,
} from 'ai';
import {
  builtinModels,
  cloudApiKey,
  defaultModelFor,
  embeddedLlamaConfigured,
  type LMSettings,
} from '../env-config.js';

import { delegate } from '../provider-runtime.js';
import { createEmbeddedLlamaCppLanguageModel } from './embedded-llamacpp.js';
import { createLlamaCppFetch, LLAMACPP_HOST_DEFAULT } from './llamacpp.js';
import { createMockModel } from './mock-model.js';
import { resolveOfflineTier } from './routing.js';
import { getLMSettings } from './settings.js';
import { withThinkingDisabled } from './thinking.js';
import { detectDevice, getWebLLMRuntime } from './webllm.js';

// S4 (TODO20): strip tool-calling directives local models cannot honor —
// prevents spoofed function-call payloads from leaking into responses.
// (`function_call` is legacy OpenAI wire format; the transformers.js provider
// never emits it, so `toolChoice` is the only strip point needed here.)
const stripUnsupportedToolChoice = (): LanguageModelMiddleware => ({
  transformParams: async ({ params }) => ({ ...params, toolChoice: undefined }),
});

/** Progress callback type for model download/initialization. */
export type ModelDownloadProgressCallback = (progress: number) => void;

export const localModel = (
  model: string,
  settings: LMSettings,
  onProgress?: ModelDownloadProgressCallback
): LanguageModel => {
  // H7: per-slot dtype (LM_QUALITY_DTYPE/LM_FAST_DTYPE) over global LM_DTYPE over quantized flag.
  const isQuality = model === settings.model || model === defaultModelFor(settings.provider);
  const dtype =
    (isQuality
      ? (settings.qualityDtype ?? settings.dtype)
      : (settings.fastDtype ?? settings.dtype)) ?? (settings.quantized ? 'q4' : 'fp32');
  return wrapLanguageModel({
    model: transformersJS(model, {
      device: detectDevice(),
      dtype,
      ...(settings.cacheDir ? { cacheDir: settings.cacheDir } : {}),
      ...(onProgress ? { initProgressCallback: onProgress } : {}),
    } as Parameters<typeof transformersJS>[1]),
    middleware: stripUnsupportedToolChoice(),
  });
};

export const mockModel = (): LanguageModel => createMockLanguageModel() as unknown as LanguageModel;

export const setBuiltinProgressCallback = delegate('setBuiltinProgressCallback');
export const getBuiltinProgressCallback = delegate('getBuiltinProgressCallback');

export function createSeNARSRegistry(settings?: LMSettings) {
  const s = settings ?? getLMSettings();
  const { provider, model: modelOverride, fastModel, structuredModel, compactModel, baseUrl } = s;

  const hasCloudKey = Boolean(cloudApiKey(s.apiKeyEnv));
  // anthropic/openai need a credential to be usable; openai-compatible is the
  // generic OpenAI-shaped lane (local daemons like ollama included — no key).
  const useCloud =
    provider === 'openai-compatible' ||
    ((provider === 'anthropic' || provider === 'openai') && hasCloudKey);
  const useWebLLM =
    provider === 'webllm' &&
    typeof getWebLLMRuntime() !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'gpu' in navigator;
  const useLlamaCpp = provider === 'llamacpp';
  // GGUF must be configured AND on disk — otherwise the slots are omitted so
  // routing failover skips them (defaults degrade to builtin transformers).
  const useEmbeddedLlamaCpp = provider === 'llamacpp-embedded' && embeddedLlamaConfigured();

  const llamacpp = createOpenAICompatible({
    name: 'llamacpp',
    apiKey: 'none',
    baseURL: `${(s.llamacppHost ?? LLAMACPP_HOST_DEFAULT).replace(/\/v1\/?$/, '')}/v1`,
    // Edge models (Qwen/Gemma reasoners) burn all tokens on reasoning_content
    // by default — thinking stays off unless explicitly re-enabled.
    fetch: createLlamaCppFetch({ disableThinking: s.disableThinking !== false }),
  });
  const thinkingAwareFetch = s.disableThinking ? withThinkingDisabled() : undefined;
  const cloud = createOpenAICompatible({
    name: 'cloud',
    apiKey: cloudApiKey(s.apiKeyEnv) ?? '',
    baseURL:
      baseUrl ??
      (provider === 'anthropic'
        ? 'https://api.anthropic.com/v1'
        : provider === 'openai'
          ? 'https://api.openai.com/v1'
          : 'http://localhost:11434/v1'),
    ...(thinkingAwareFetch && { fetch: thinkingAwareFetch }),
  });
  const frontierId = modelOverride ?? defaultModelFor(provider);
  const builtinCompact = compactModel ?? builtinModels.compact;
  const offlineTier = resolveOfflineTier(s);

  const webllm = getWebLLMRuntime();
  const webllmQuality = useWebLLM ? webllm?.createModel('llama-3.2-3b-instruct') : undefined;
  const webllmFast = useWebLLM ? webllm?.createModel('phi-3.5-mini-instruct') : undefined;

  // Unavailable slots are omitted (not mocked) so registry.languageModel() throws
  // and routing failover skips them instead of silently admitting a placeholder.
  return createProviderRegistry({
    cloud: customProvider({
      languageModels: {
        ...(useCloud && {
          quality: cloud(frontierId),
          fast: cloud(fastModel ?? frontierId),
          structured: cloud(structuredModel ?? frontierId),
          compact: cloud(compactModel ?? frontierId),
        }),
      },
      fallbackProvider: useCloud ? cloud : undefined,
    }),
    llamacpp: customProvider({
      languageModels: {
        ...(useLlamaCpp && {
          quality: llamacpp(modelOverride ?? defaultModelFor('llamacpp')),
          fast: llamacpp(fastModel ?? defaultModelFor('llamacpp')),
          structured: llamacpp(structuredModel ?? defaultModelFor('llamacpp')),
          compact: llamacpp(compactModel ?? defaultModelFor('llamacpp')),
        }),
      },
      fallbackProvider: useLlamaCpp ? llamacpp : undefined,
    }),
    'llamacpp-embedded': customProvider({
      languageModels: {
        ...(useEmbeddedLlamaCpp && {
          quality: createEmbeddedLlamaCppLanguageModel('quality'),
          fast: createEmbeddedLlamaCppLanguageModel('fast'),
          structured: createEmbeddedLlamaCppLanguageModel('structured'),
          compact: createEmbeddedLlamaCppLanguageModel('compact'),
        }),
      },
    }),
    webllm: customProvider({
      languageModels: {
        ...(useWebLLM && {
          quality: webllmQuality,
          fast: webllmFast,
          structured: webllmQuality,
          compact: webllmFast,
        }),
      },
      fallbackProvider: useWebLLM ? undefined : undefined,
    }),
    builtin: customProvider({
      languageModels: {
        quality: localModel(
          offlineTier ?? modelOverride ?? builtinModels.quality,
          s,
          getBuiltinProgressCallback()
        ),
        fast: localModel(builtinCompact, s, getBuiltinProgressCallback()),
        structured: localModel(
          offlineTier ?? modelOverride ?? builtinModels.quality,
          s,
          getBuiltinProgressCallback()
        ),
        compact: localModel(builtinCompact, s, getBuiltinProgressCallback()),
        mock: mockModel(),
      },
    }),
  });
}

export type SeNARSRegistry = ReturnType<typeof createSeNARSRegistry>;
export type SeNARSModelId = Parameters<SeNARSRegistry['languageModel']>[0];

// ---- Mock model (shared shim — see providers/mock-model.ts) ----

export function createMockLanguageModel(
  generateTextFn?: (prompt: string) => string | Promise<string>
): LanguageModelV3 {
  return createMockModel({
    generateTextFn,
    transformText: (text, options) =>
      options.responseFormat?.type === 'json'
        ? JSON.stringify({ result: 'mock', data: text.slice(0, 100) })
        : text,
  });
}
