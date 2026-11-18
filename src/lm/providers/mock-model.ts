import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
} from '@ai-sdk/provider';
import { extractLastUserMessage } from '@senars/util';
import { MockLanguageModelV3, simulateReadableStream } from 'ai/test';

export interface MockModelOptions {
  provider?: string;
  modelId?: string;
  /** Prompt → response text; defaults to `defaultText(lastUserMessage)`. */
  generateTextFn?: (prompt: string) => string | Promise<string>;
  defaultText?: (lastUserMessage: string) => string;
  /** Wrap the generated text (e.g. force a JSON envelope for structured calls). */
  transformText?: (text: string, options: LanguageModelV3CallOptions) => string;
}

const NO_CACHE_TOKENS = { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 } as const;

const textUsage = (text: string) => ({
  inputTokens: NO_CACHE_TOKENS,
  outputTokens: { total: text.length, text: text.length, reasoning: 0 },
});

const STOP = { unified: 'stop', raw: 'stop' } as const;

/**
 * The single mock `LanguageModelV3` shim: one `doGenerate`/`doStream` pair
 * shared by the mock LM service, the provider factory, and transport stubs.
 */
export function createMockModel({
  provider = 'mock',
  modelId = 'mock',
  generateTextFn,
  defaultText = (key) => `Mock response: ${key.slice(0, 50)}`,
  transformText,
}: MockModelOptions = {}): LanguageModelV3 {
  const respond = async (options: LanguageModelV3CallOptions): Promise<string> => {
    const key = extractLastUserMessage(options.prompt ?? []);
    const text = generateTextFn ? await generateTextFn(key) : defaultText(key);
    return transformText ? transformText(text, options) : text;
  };

  const doGenerate: LanguageModelV3['doGenerate'] = async (options) => {
    const text = await respond(options);
    const result: LanguageModelV3GenerateResult = {
      content: [{ type: 'text', text }],
      finishReason: STOP,
      usage: textUsage(text),
      warnings: [],
    };
    return result;
  };

  const doStream: LanguageModelV3['doStream'] = async (options) => {
    const text = await respond(options);
    const chunks: LanguageModelV3StreamPart[] = [
      { type: 'text-start', id: '0' },
      { type: 'text-delta', id: '0', delta: text },
      { type: 'text-end', id: '0' },
      { type: 'finish', finishReason: STOP, usage: textUsage(text) },
    ];
    const result: LanguageModelV3StreamResult = { stream: simulateReadableStream({ chunks }) };
    return result;
  };

  return new MockLanguageModelV3({ provider, modelId, doGenerate, doStream });
}
