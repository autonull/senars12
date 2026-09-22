import type {
  LanguageModelV3,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
} from '@ai-sdk/provider';
import type { LMExecutionStats, LMTask, MockLMConfig } from '@senars/util';
import { extractLastUserMessage } from '@senars/util';
import type { LanguageModel } from 'ai';
import type { ZodSchema } from 'zod';
import { MockLanguageModelV3, simulateReadableStream } from 'ai/test';
import type { LMService } from './LMService.js';
import { createLMStats, recordLMCall } from '../stats.js';
import { ProviderSpend } from './spend.js';

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

  getSpend(): Record<string, ProviderSpend> {
    return {};
  }
}
