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
import { SenarsError } from '@senars/util/errors';
import {
  createSeNARSRegistry,
  demoteModel,
  getLastRoutingDecision,
  getLMSettings,
  getLmProvider,
  getModelForTask,
  getModelChain,
  resolveActiveProvider,
  setBuiltinProgressCallback,
  type ModelDownloadProgressCallback,
  canUseProvider,
  recordProviderCall,
  getCircuitBreaker,
  getAllCircuitBreakers,
  type CircuitBreakerConfig,
  type LMProviderName,
  logRoutingDecision,
  type RoutingTelemetryEntry,
} from './providers.js';
import { createLMStats, recordLMCall } from './stats.js';

/** Typed error for provider/transport failures (offline fallbacks, re-probing). */
export class LMUnavailableError extends SenarsError {
  readonly provider: string | undefined;
  readonly task: LMTask | undefined;
  readonly detail: unknown;

  constructor(message: string, provider?: string, task?: LMTask, detail?: unknown) {
    super(message, 'LM_UNAVAILABLE', { provider, task, detail });
    this.provider = provider;
    this.task = task;
    this.detail = detail;
  }
}

const isTransportError = (e: unknown): boolean => {
  const msg = e instanceof Error ? e.message.toLowerCase() : String(e).toLowerCase();
  return (
    /\b(fetch|network|econn|timeout|aborted|socket|rate.?limit|5\d\d)\b/.test(msg) ||
    /failed to (fetch|connect)/.test(msg)
  );
};

const backoff = (attempt: number): number => 250 * 2 ** (attempt - 1);

const withRetry = async <T>(
  fn: () => Promise<T>,
  provider: string | undefined,
  task: LMTask,
  retries = 2
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt > retries || !isTransportError(e)) break;
      await new Promise((r) => setTimeout(r, backoff(attempt)));
    }
  }
  throw new LMUnavailableError(
    `LM provider unavailable (${provider ?? 'unknown'}): ${(lastError as Error)?.message ?? String(lastError)}`,
    provider,
    task,
    lastError
  );
};

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
  private reprobeDone = false;
  /** Consecutive transport failures per resolved model id → demotion (R5). */
  private failures = new Map<string, number>();
  /** Per-model-id execution stats feeding stats-aware chain reordering (R4/R5). */
  private perModel = new Map<string, LMExecutionStats>();
  /** Optional progress callback for transformers.js model downloads. */
  private progressCallback: ModelDownloadProgressCallback | undefined;

  constructor(
    private registry: SeNARSRegistry,
    progressCallback?: ModelDownloadProgressCallback
  ) {
    this.progressCallback = progressCallback;
    if (progressCallback) {
      setBuiltinProgressCallback(progressCallback);
    }
  }

  /** Set or update the model download progress callback. */
  setProgressCallback(cb: ModelDownloadProgressCallback | undefined): void {
    this.progressCallback = cb;
    setBuiltinProgressCallback(cb);
  }

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
      return getModelForTask(this.registry, task, undefined, this.getModelStats()) as LanguageModel;
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

    const provider = this.provider as LMProviderName | undefined;
    const settings = getLMSettings();
    if (provider && !canUseProvider(provider, settings)) {
      throw new LMUnavailableError(`Circuit breaker open for provider: ${provider}`, provider, opts?.task);
    }

    const start = Date.now();
    const task = opts?.task ?? 'fast';
    try {
      const text = await withRetry(
        async () => {
          const { text: out } = await generateText({
            model,
            prompt,
            abortSignal: opts?.signal,
            temperature: opts?.temperature,
            maxOutputTokens: opts?.maxOutputTokens,
          });
          return out;
        },
        provider,
        task
      );
      this.recordCall(true, start, prompt.length + text.length);
      if (provider) recordProviderCall(provider, true, settings);
      this.noteSuccess();
      // Log routing decision
      const decision = getLastRoutingDecision();
      if (decision) {
        logRoutingDecision({
          ts: Date.now(),
          task,
          modelId: decision.modelId,
          latencyMs: Date.now() - start,
          success: true,
          demoted: decision.reason === 'failover',
          provider: provider ?? 'unknown',
          chain: getModelChain(provider ?? getLmProvider(), task),
        });
      }
      return text;
    } catch (e) {
      this.recordCall(false, start, prompt.length);
      if (provider) recordProviderCall(provider, false, settings);
      if (isTransportError(e)) {
        this.noteFailure();
        await this.reprobe();
      }
      // Log routing decision on failure
      const decision = getLastRoutingDecision();
      if (decision) {
        logRoutingDecision({
          ts: Date.now(),
          task,
          modelId: decision.modelId,
          latencyMs: Date.now() - start,
          success: false,
          demoted: false,
          provider: provider ?? 'unknown',
          chain: getModelChain(provider ?? getLmProvider(), task),
        });
      }
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

    const provider = this.provider as LMProviderName | undefined;
    const settings = getLMSettings();
    if (provider && !canUseProvider(provider, settings)) {
      throw new LMUnavailableError(`Circuit breaker open for provider: ${provider}`, provider, opts?.task);
    }

    const start = Date.now();
    const task = opts?.task ?? 'structured';
    try {
      const object = await withRetry(
        async () => {
          const { object: out } = await generateObject({
            model,
            prompt,
            schema: zodSchema(schema),
            abortSignal: opts?.signal,
          });
          return out;
        },
        provider,
        task
      );
      this.recordCall(true, start, prompt.length + JSON.stringify(object).length);
      if (provider) recordProviderCall(provider, true, settings);
      // Log routing decision
      const decision = getLastRoutingDecision();
      if (decision) {
        logRoutingDecision({
          ts: Date.now(),
          task,
          modelId: decision.modelId,
          latencyMs: Date.now() - start,
          success: true,
          demoted: decision.reason === 'failover',
          provider: provider ?? 'unknown',
          chain: getModelChain(provider ?? getLmProvider(), task),
        });
      }
      return object;
    } catch (e) {
      this.recordCall(false, start, prompt.length);
      if (provider) recordProviderCall(provider, false, settings);
      if (isTransportError(e)) await this.reprobe();
      // Log routing decision on failure
      const decision = getLastRoutingDecision();
      if (decision) {
        logRoutingDecision({
          ts: Date.now(),
          task,
          modelId: decision.modelId,
          latencyMs: Date.now() - start,
          success: false,
          demoted: false,
          provider: provider ?? 'unknown',
          chain: getModelChain(provider ?? getLmProvider(), task),
        });
      }
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

  /** One-shot re-probe of the active provider after transport failures. */
  private async reprobe(): Promise<void> {
    if (this.reprobeDone) return;
    this.reprobeDone = true;
    try {
      const active = await resolveActiveProvider();
      if (active !== this.provider) {
        this.registry = createSeNARSRegistry({ ...getLMSettings(), provider: active });
      }
    } catch {
      /* keep current registry */
    }
  }

  private recordCall(success: boolean, start: number, tokens: number): void {
    recordLMCall(this.stats, success, Date.now() - start, tokens);
    const id = getLastRoutingDecision()?.modelId;
    if (!id) return;
    let m = this.perModel.get(id);
    if (!m) {
      m = createLMStats();
      this.perModel.set(id, m);
    }
    recordLMCall(m, success, Date.now() - start, tokens);
  }

  getModelStats(): Record<string, LMExecutionStats> {
    return Object.fromEntries(this.perModel);
  }

  private noteSuccess(): void {
    const id = getLastRoutingDecision()?.modelId;
    if (id) this.failures.delete(id);
  }

  private noteFailure(): void {
    const id = getLastRoutingDecision()?.modelId;
    if (!id) return;
    const n = (this.failures.get(id) ?? 0) + 1;
    this.failures.set(id, n);
    if (n >= 2) demoteModel(id, `repeated transport failures (${n})`);
  }

  /** Get circuit breaker status for all providers. */
  getCircuitBreakerStatus(): Map<string, ReturnType<typeof getCircuitBreaker>> {
    return getAllCircuitBreakers();
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
