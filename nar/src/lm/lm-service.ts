import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
} from '@ai-sdk/provider';
import type {
  LMExecutionStats,
  LMRuleConfig,
  LMRuleStats,
  LMTask,
  MockLMConfig,
} from '@senars/util';
import { generateObject, generateText, type LanguageModel, streamText, zodSchema } from 'ai';
import { MockLanguageModelV3, simulateReadableStream } from 'ai/test';
import type { ZodSchema } from 'zod';
import type { SeNARSRegistry } from './providers.js';
import { createSeNARSRegistry, getModelForTask } from './providers.js';
import { createLMStats, recordLMCall } from './stats.js';

export type {
  LMExecutionStats,
  LMPromptGenerator,
  LMResponseProcessor,
  LMRuleConfig,
  LMRuleStats,
  LMTask,
  LMTaskGenerator,
  MockLMConfig,
} from '@senars/util';

export class LMService {
  private stats: LMExecutionStats = createLMStats();

  constructor(private registry: SeNARSRegistry) {}

  get provider(): string | undefined {
    const model = this.getModel('quality');
    return (model as { provider?: string })?.provider;
  }

  get model(): string | undefined {
    const model = this.getModel('quality');
    return (model as { modelId?: string })?.modelId;
  }

  get available(): boolean {
    return this.hasModel();
  }

  getModel(task: LMTask): LanguageModel | undefined {
    try {
      return getModelForTask(this.registry, task) as LanguageModel;
    } catch {
      return undefined;
    }
  }

  hasModel(): boolean {
    return !!this.getModel('fast');
  }

  getStats(): LMExecutionStats {
    return { ...this.stats };
  }

  async generateText(
    prompt: string,
    opts?: {
      task?: LMTask;
      signal?: AbortSignal;
      temperature?: number;
      maxOutputTokens?: number;
    }
  ): Promise<string> {
    const model = this.getModel(opts?.task ?? 'fast');
    if (!model) throw new Error('No model available');

    const start = Date.now();
    try {
      const { text } = await generateText({
        model,
        prompt,
        abortSignal: opts?.signal,
        temperature: opts?.temperature,
        maxOutputTokens: opts?.maxOutputTokens,
      });
      this.recordCall(true, start, prompt.length + text.length);
      return text;
    } catch (e) {
      this.recordCall(false, start, prompt.length);
      throw e;
    }
  }

  async generateObject<T>(
    prompt: string,
    schema: ZodSchema<T>,
    opts?: {
      task?: LMTask;
      signal?: AbortSignal;
    }
  ): Promise<T> {
    const model = this.getModel(opts?.task ?? 'structured');
    if (!model) throw new Error('No model available');

    const start = Date.now();
    try {
      const { object } = await generateObject({
        model,
        prompt,
        schema: zodSchema(schema),
        abortSignal: opts?.signal,
      });
      this.recordCall(true, start, prompt.length + JSON.stringify(object).length);
      return object;
    } catch (e) {
      this.recordCall(false, start, prompt.length);
      throw e;
    }
  }

  async *stream(
    prompt: string,
    opts?: {
      task?: LMTask;
      signal?: AbortSignal;
    }
  ): AsyncIterable<string> {
    const model = this.getModel(opts?.task ?? 'fast');
    if (!model) return;

    const result = streamText({
      model,
      prompt,
      abortSignal: opts?.signal,
    });
    for await (const chunk of result.textStream) {
      yield chunk;
    }
  }

  private recordCall(success: boolean, start: number, tokens: number): void {
    recordLMCall(this.stats, success, Date.now() - start, tokens);
  }
}

export function createLMService(): LMService {
  const registry = createSeNARSRegistry();
  return new LMService(registry);
}

export function createMockLMService(config: MockLMConfig = {}): LMService {
  const {
    generateTextFn,
    generateObjectFn,
    available = true,
    provider = 'mock',
    model = 'mock',
  } = config;
  const service = new MockLMServiceImpl(
    generateTextFn,
    generateObjectFn,
    available,
    provider,
    model
  );
  return service as unknown as LMService;
}

class MockLMServiceImpl {
  private stats: LMExecutionStats = createLMStats();

  constructor(
    private readonly _generateTextFn?: (prompt: string) => string | Promise<string>,
    private readonly _generateObjectFn?: <T>(
      prompt: string,
      schema: ZodSchema<T>
    ) => T | Promise<T>,
    private readonly _available: boolean = true,
    private readonly _provider: string = 'mock',
    private readonly _model: string = 'mock'
  ) {}

  get provider(): string {
    return this._provider;
  }

  get model(): string {
    return this._model;
  }

  get available(): boolean {
    return this._available;
  }

  getModel(_task: LMTask): LanguageModel | undefined {
    const doGenerate: LanguageModelV3['doGenerate'] = async (options) => {
      const key = extractLastUserMessage(options.prompt ?? []);
      const text = this._generateTextFn ? await this._generateTextFn(key) : 'Mock response';
      const result: LanguageModelV3GenerateResult = {
        content: [{ type: 'text', text }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: text.length, text: text.length, reasoning: 0 },
        },
        warnings: [],
      };
      return result;
    };
    const doStream: LanguageModelV3['doStream'] = async (options) => {
      const key = extractLastUserMessage(options.prompt ?? []);
      const text = this._generateTextFn ? await this._generateTextFn(key) : 'Mock response';
      const chunks: LanguageModelV3StreamPart[] = [
        { type: 'text-start', id: '0' },
        { type: 'text-delta', id: '0', delta: text },
        { type: 'text-end', id: '0' },
        {
          type: 'finish',
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: {
            inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: text.length, text: text.length, reasoning: 0 },
          },
        },
      ];
      const result: LanguageModelV3StreamResult = {
        stream: simulateReadableStream({ chunks }),
      };
      return result;
    };
    return new MockLanguageModelV3({
      provider: this._provider,
      modelId: this._model,
      doGenerate,
      doStream,
    }) as unknown as LanguageModel;
  }

  hasModel(): boolean {
    return this._available;
  }

  getStats(): LMExecutionStats {
    return { ...this.stats };
  }

  async generateText(prompt: string): Promise<string> {
    const start = Date.now();
    try {
      const text = this._generateTextFn ? await this._generateTextFn(prompt) : 'Mock response';
      this.recordCall(true, start, prompt.length + text.length);
      return text;
    } catch (e) {
      this.recordCall(false, start, prompt.length);
      throw e;
    }
  }

  async generateObject<T>(_prompt: string, schema: ZodSchema<T>): Promise<T> {
    const start = Date.now();
    try {
      const obj = this._generateObjectFn
        ? await this._generateObjectFn(_prompt, schema)
        : ({} as T);
      this.recordCall(true, start, JSON.stringify(obj).length);
      return obj;
    } catch (e) {
      this.recordCall(false, start, 0);
      throw e;
    }
  }

  async *stream(_prompt: string): AsyncIterable<string> {
    yield '';
  }

  private recordCall(success: boolean, start: number, tokens: number): void {
    recordLMCall(this.stats, success, Date.now() - start, tokens);
  }
}

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
  return extractLastUserMessage(prompt ?? []);
}

function extractLastUserMessage(messages: Array<{ role?: string; content: unknown }>): string {
  if (!messages || messages.length === 0) return '';
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUser) return '';
  const c = lastUser.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c))
    return c
      .map((p: { type?: string; text?: string }) => (p.type === 'text' ? p.text : ''))
      .join('');
  return '';
}
