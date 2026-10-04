import {
  createLMStats,
  type LMExecutionStats,
  type LMTask,
  type MockLMConfig,
  recordLMCall,
  stopwatch,
} from '@senars/util';
import type { LanguageModel } from 'ai';
import type { ZodSchema } from 'zod';
import { createMockModel } from '../providers/mock-model.js';
import type { LMService } from './LMService.js';
import type { ProviderSpend } from './spend.js';

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
    return createMockModel({
      provider: this._provider,
      modelId: this._model,
      generateTextFn: this._generateTextFn,
      defaultText: () => 'Mock response',
    }) as unknown as LanguageModel;
  }

  hasModel(): boolean {
    return this._available;
  }

  getStats(): LMExecutionStats {
    return { ...this.stats };
  }

  async generateText(prompt: string): Promise<string> {
    const elapsed = stopwatch();
    try {
      const text = this._generateTextFn ? await this._generateTextFn(prompt) : 'Mock response';
      this.recordCall(true, elapsed(), prompt.length + text.length);
      return text;
    } catch (e) {
      this.recordCall(false, elapsed(), prompt.length);
      throw e;
    }
  }

  async generateObject<T>(_prompt: string, schema: ZodSchema<T>): Promise<T> {
    const elapsed = stopwatch();
    try {
      const obj = this._generateObjectFn
        ? await this._generateObjectFn(_prompt, schema)
        : ({} as T);
      this.recordCall(true, elapsed(), JSON.stringify(obj).length);
      return obj;
    } catch (e) {
      this.recordCall(false, elapsed(), 0);
      throw e;
    }
  }

  async *stream(_prompt: string): AsyncIterable<string> {
    yield '';
  }

  private recordCall(success: boolean, durationMs: number, tokens: number): void {
    recordLMCall(this.stats, success, durationMs, tokens);
  }

  getSpend(): Record<string, ProviderSpend> {
    return {};
  }
}
