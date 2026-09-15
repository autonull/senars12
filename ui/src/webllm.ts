import type { LanguageModelV4, LanguageModelV4CallOptions, LanguageModelV4GenerateResult, LanguageModelV4StreamResult, LanguageModelV4StreamPart, LanguageModelV4Usage, LanguageModelV4FinishReason, LanguageModelV4Content, SharedV4ProviderMetadata, SharedV4Warning } from '@ai-sdk/provider';
import { CreateMLCEngine, type MLCEngineInterface, type ChatCompletionMessageParam, type ChatCompletionChunk, type ChatCompletion, type ChatCompletionContentPart } from '@mlc-ai/web-llm';

interface WebLLMModelConfig {
  modelId: string;
  modelLib?: string;
}

interface WebLLMProviderConfig {
  models: Record<string, WebLLMModelConfig>;
  defaultModel: string;
}

const WEBLLM_MODELS: WebLLMProviderConfig = {
  models: {
    'llama-3.2-3b-instruct': {
      modelId: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
      modelLib: 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/dist/Llama-3.2-3B-Instruct-q4f32_1-MLC/',
    },
    'phi-3.5-mini-instruct': {
      modelId: 'Phi-3.5-mini-instruct-q4f32_1-MLC',
      modelLib: 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/dist/Phi-3.5-mini-instruct-q4f32_1-MLC/',
    },
    'gemma-2-2b-it': {
      modelId: 'gemma-2-2b-it-q4f32_1-MLC',
      modelLib: 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/dist/gemma-2-2b-it-q4f32_1-MLC/',
    },
  },
  defaultModel: 'llama-3.2-3b-instruct',
};

let engineCache: Map<string, MLCEngineInterface> = new Map();
let initPromises: Map<string, Promise<MLCEngineInterface>> = new Map();

async function getOrCreateEngine(modelKey: string, onProgress?: (progress: number) => void): Promise<MLCEngineInterface> {
  const cached = engineCache.get(modelKey);
  if (cached) return cached;

  const existingInit = initPromises.get(modelKey);
  if (existingInit) return existingInit;

  const modelConfig = WEBLLM_MODELS.models[modelKey] ?? WEBLLM_MODELS.models[WEBLLM_MODELS.defaultModel];
  if (!modelConfig) {
    throw new Error(`Model ${modelKey} not found and no default model configured`);
  }
  const initPromise = CreateMLCEngine(modelConfig.modelId, {
    initProgressCallback: (report: { progress: number }) => {
      onProgress?.(report.progress);
    },
  }) as Promise<MLCEngineInterface>;

  initPromises.set(modelKey, initPromise);

  try {
    const engine = await initPromise;
    engineCache.set(modelKey, engine);
    initPromises.delete(modelKey);
    return engine;
  } catch (e) {
    initPromises.delete(modelKey);
    throw e;
  }
}

function getTextContent(content: string | ChatCompletionContentPart[] | null | undefined): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  return content
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
}

function convertMessages(prompt: LanguageModelV4CallOptions['prompt']): ChatCompletionMessageParam[] {
  return prompt.map((msg) => {
    const role = msg.role;
    const content = getTextContent(msg.content as string | ChatCompletionContentPart[] | null | undefined);

    if (role === 'system') {
      return { role: 'system', content };
    } else if (role === 'user') {
      return { role: 'user', content };
    } else if (role === 'assistant') {
      return { role: 'assistant', content };
    } else {
      return { role: 'user', content };
    }
  });
}

function mapFinishReason(reason: string | null | undefined): LanguageModelV4FinishReason {
  let unified: LanguageModelV4FinishReason['unified'] = 'other';
  switch (reason) {
    case 'stop': unified = 'stop'; break;
    case 'length': unified = 'length'; break;
    case 'tool_calls': unified = 'tool-calls'; break;
    case 'content_filter': unified = 'content-filter'; break;
  }
  return { unified, raw: reason ?? undefined };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function createUsage(inputTokens: number, outputTokens: number): LanguageModelV4Usage {
  return {
    inputTokens: { total: inputTokens, noCache: inputTokens, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: outputTokens, text: outputTokens, reasoning: 0 },
  };
}

export function createWebLLMModel(modelKey?: string, onProgress?: (progress: number) => void): LanguageModelV4 {
  const key = modelKey ?? WEBLLM_MODELS.defaultModel;

  return {
    specificationVersion: 'v4',
    provider: 'webllm',
    modelId: key,
    supportedUrls: {},

    async doGenerate(options: LanguageModelV4CallOptions): Promise<LanguageModelV4GenerateResult> {
      const engine = await getOrCreateEngine(key, onProgress);
      const messages = convertMessages(options.prompt);

      const reply = await engine.chat.completions.create({
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxOutputTokens ?? 2048,
        stream: false,
      }) as ChatCompletion;

      const content = reply.choices[0]?.message?.content ?? '';
      const usage = reply.usage;

      const responseContent: LanguageModelV4Content[] = [
        { type: 'text', text: content },
      ];

      return {
        content: responseContent,
        finishReason: mapFinishReason(reply.choices[0]?.finish_reason ?? 'stop'),
        usage: createUsage(
          usage?.prompt_tokens ?? estimateTokens(messages.map(m => getTextContent(m.content)).join('')),
          usage?.completion_tokens ?? estimateTokens(content)
        ),
        warnings: [],
      };
    },

    async doStream(options: LanguageModelV4CallOptions): Promise<LanguageModelV4StreamResult> {
      const engine = await getOrCreateEngine(key, onProgress);
      const messages = convertMessages(options.prompt);

      const stream = await engine.chat.completions.create({
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxOutputTokens ?? 2048,
        stream: true,
      }) as AsyncIterable<ChatCompletionChunk>;

      let textId = 0;

      const readableStream = new ReadableStream<LanguageModelV4StreamPart>({
        async start(controller) {
          let accumulatedContent = '';
          let finishReason: LanguageModelV4FinishReason = { unified: 'stop', raw: 'stop' };
          let inputTokens = 0;
          let outputTokens = 0;
          let hasStarted = false;

          for await (const chunk of stream) {
            const choice = chunk.choices[0];
            if (!choice) continue;

            const delta = choice.delta?.content ?? '';
            if (delta) {
              accumulatedContent += delta;
              if (!hasStarted) {
                controller.enqueue({ type: 'text-start', id: String(textId++) } as LanguageModelV4StreamPart);
                hasStarted = true;
              }
              controller.enqueue({ type: 'text-delta', id: String(textId - 1), delta } as LanguageModelV4StreamPart);
            }

            if (choice.finish_reason) {
              finishReason = mapFinishReason(choice.finish_reason);
            }
          }

          if (hasStarted) {
            controller.enqueue({ type: 'text-end', id: String(textId - 1) } as LanguageModelV4StreamPart);
          }

          inputTokens = estimateTokens(messages.map(m => getTextContent(m.content)).join(''));
          outputTokens = estimateTokens(accumulatedContent);

          controller.enqueue({
            type: 'finish',
            finishReason,
            usage: createUsage(inputTokens, outputTokens),
          } as LanguageModelV4StreamPart);
          controller.close();
        },
      });

      return { stream: readableStream };
    },
  };
}

export const webllmModels = WEBLLM_MODELS.models;

export function detectDevice(): 'webgpu' | 'cpu' {
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    return 'webgpu';
  }
  return 'cpu';
}

export async function preloadModel(modelKey?: string, onProgress?: (progress: number) => void): Promise<void> {
  const key = modelKey ?? WEBLLM_MODELS.defaultModel;
  await getOrCreateEngine(key, onProgress);
}

export function clearEngineCache(): void {
  for (const engine of engineCache.values()) {
    // MLCEngineInterface doesn't have a destroy method in the current version
    // The cache will be cleared on page unload
  }
  engineCache.clear();
  initPromises.clear();
}
/** Adapter matching nar's WebLLMRuntime injection contract (@senars/nar/lm). */
export const webllmRuntime = {
  createModel: (modelKey: string, onProgress?: (progress: number) => void) =>
    createWebLLMModel(modelKey, onProgress),
  models: webllmModels as Record<string, { id: string; label?: string }>,
};
