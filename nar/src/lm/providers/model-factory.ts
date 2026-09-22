import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
} from '@ai-sdk/provider';
import { transformersJS } from '@browser-ai/transformers-js';
import {
  createProviderRegistry,
  customProvider,
  type LanguageModel,
  type LanguageModelMiddleware,
  wrapLanguageModel,
} from 'ai';
import { MockLanguageModelV3, simulateReadableStream } from 'ai/test';
import {
  builtinModels,
  defaultModelFor,
  embeddedLlamaConfigured,
  type LMSettings,
} from '../env-config.js';

import { getProviderRuntime, type ProviderRuntime } from '../provider-runtime.js';
import { createEmbeddedLlamaCppLanguageModel } from './embedded-llamacpp.js';
import { createLlamaCppFetch, LLAMACPP_HOST_DEFAULT } from './llamacpp.js';
import { resolveOfflineTier } from './routing.js';
import { getLMSettings } from './settings.js';
import { detectDevice, getWebLLMRuntime } from './webllm.js';

const OLLAMA_HOST_DEFAULT = 'http://localhost:11434';
const OLLAMA_FAST_DEFAULT = 'llama3.2:3b';
const OLLAMA_COMPACT_DEFAULT = 'phi3:3.8b';

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

export const cloudApiKey = (settings: LMSettings): string | undefined => {
  const viaEnvName = settings.apiKeyEnv ? process.env[settings.apiKeyEnv] : undefined;
  return (
    viaEnvName ??
    process.env.LM_API_KEY ??
    process.env.ANTHROPIC_API_KEY ??
    process.env.OPENAI_API_KEY
  );
};

export const setBuiltinProgressCallback = (
  cb: ModelDownloadProgressCallback | undefined,
  rt: ProviderRuntime = getProviderRuntime()
): void => {
  rt.setBuiltinProgressCallback(cb);
};
export const getBuiltinProgressCallback = (rt: ProviderRuntime = getProviderRuntime()) =>
  rt.getBuiltinProgressCallback();

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
  const useWebLLM =
    provider === 'webllm' &&
    typeof getWebLLMRuntime() !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'gpu' in navigator;
  const useLlamaCpp = provider === 'llamacpp';
  // GGUF must be configured AND on disk — otherwise the slots are omitted so
  // routing failover skips them (defaults degrade to builtin transformers).
  const useEmbeddedLlamaCpp = provider === 'llamacpp-embedded' && embeddedLlamaConfigured();

  const ollama = createOpenAICompatible({
    name: 'ollama',
    apiKey: 'ollama',
    baseURL: `${(ollamaHost ?? OLLAMA_HOST_DEFAULT).replace(/\/v1\/?$/, '')}/v1`,
  });
  const llamacpp = createOpenAICompatible({
    name: 'llamacpp',
    apiKey: 'none',
    baseURL: `${(s.llamacppHost ?? LLAMACPP_HOST_DEFAULT).replace(/\/v1\/?$/, '')}/v1`,
    // Edge models (Qwen/Gemma reasoners) burn all tokens on reasoning_content
    // by default — thinking stays off unless explicitly re-enabled.
    fetch: createLlamaCppFetch({ disableThinking: s.disableThinking !== false }),
  });
  const thinkingAwareFetch: typeof fetch | undefined = s.disableThinking
    ? (input, init) => {
        if (typeof init?.body === 'string') {
          try {
            const body = JSON.parse(init.body);
            if (body.messages && !body.chat_template_kwargs) {
              body.chat_template_kwargs = { enable_thinking: false };
              init = { ...init, body: JSON.stringify(body) };
            }
          } catch {}
        }
        return fetch(input, init);
      }
    : undefined;
  const cloud = createOpenAICompatible({
    name: 'cloud',
    apiKey: cloudApiKey(s) ?? '',
    baseURL:
      baseUrl ??
      (provider === 'anthropic' ? 'https://api.anthropic.com/v1' : 'https://api.openai.com/v1'),
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
    local: customProvider({
      languageModels: {
        ...(useLocal && {
          quality: ollama(modelOverride ?? defaultModelFor('ollama')),
          fast: ollama(fastModel ?? OLLAMA_FAST_DEFAULT),
          compact: ollama(compactModel ?? OLLAMA_COMPACT_DEFAULT),
        }),
      },
      fallbackProvider: useLocal ? ollama : undefined,
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

// ---- Mock model (moved from lm-service — M3: breaks lm-service -> providers cycle) ----

export function createMockLanguageModel(
  generateTextFn?: (prompt: string) => string | Promise<string>
): LanguageModelV3 {
  const doGenerate: LanguageModelV3['doGenerate'] = async (options: LanguageModelV3CallOptions) => {
    const key = extractTextFromPrompt(options.prompt);
    let responseText = generateTextFn
      ? await generateTextFn(key)
      : `Mock response: ${key.slice(0, 50)}`;

    if (options.responseFormat?.type === 'json') {
      responseText = JSON.stringify({ result: 'mock', data: responseText.slice(0, 100) });
    }

    const result: LanguageModelV3GenerateResult = {
      content: [{ type: 'text', text: responseText }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: responseText.length, text: responseText.length, reasoning: 0 },
      },
      warnings: [],
    };
    return result;
  };
  const doStream: LanguageModelV3['doStream'] = async (options: LanguageModelV3CallOptions) => {
    const key = extractTextFromPrompt(options.prompt);
    const responseText = generateTextFn
      ? await generateTextFn(key)
      : `Mock response: ${key.slice(0, 50)}`;
    const chunks: LanguageModelV3StreamPart[] = [
      { type: 'text-start', id: '0' },
      { type: 'text-delta', id: '0', delta: responseText },
      { type: 'text-end', id: '0' },
      {
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
          outputTokens: {
            total: responseText.length,
            text: responseText.length,
            reasoning: 0,
          },
        },
      },
    ];
    const result: LanguageModelV3StreamResult = {
      stream: simulateReadableStream({ chunks }),
    };
    return result;
  };
  return new MockLanguageModelV3({
    provider: 'mock',
    modelId: 'mock',
    doGenerate,
    doStream,
  });
}

function extractTextFromPrompt(prompt: LanguageModelV3CallOptions['prompt']): string {
  const last = [...(prompt ?? [])].reverse().find((m) => m.role === 'user');
  const content = last?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const text = content.find((c) => c.type === 'text');
    if (text && 'text' in text) return String(text.text);
  }
  return '';
}
