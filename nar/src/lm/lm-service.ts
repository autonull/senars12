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
import { z } from 'zod';
import type { SeNARSRegistry } from './providers.js';
import { loadGrammar, type GrammarName } from './grammars/index.js';
import { runWithGrammar } from './providers/llamacpp.js';

const NAMED_GRAMMARS: ReadonlySet<string> = new Set<string>(['narsese-term', 'single-word']);
import { SenarsError } from '@senars/util/errors';
import {
  createSeNARSRegistry,
  demoteModel,
  getLastRoutingDecision,
  getLMSettings,
  getLmProvider,
  getModelForTask,
  getModelChain,
  getModelCapability,
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
import { recordLmSpend } from '../metrics/index.js';

interface CacheEntry {
  value: string;
  expiresAt: number;
}

/** H6/X14: provider-specific remediation hints appended to LM failures. */
const LADDER_HINTS: Partial<Record<string, string>> = {
  ollama: "start the server ('ollama serve') or set LM_PROVIDER=mock",
  'llamacpp-embedded': "fetch a GGUF model first ('pnpm exec tsx scripts/fetch-model.ts')",
  llamacpp: 'start llama-server or set LM_PROVIDER=mock',
  transformers: 'check the model cache dir / network for the model download',
  webllm: 'requires WebGPU (browser context only)',
  anthropic: 'set ANTHROPIC_API_KEY or fall back to a local provider',
  openai: 'set OPENAI_API_KEY or fall back to a local provider',
  'openai-compatible': 'set LM_BASE_URL + credentials or fall back to a local provider',
  mock: 'LM_PROVIDER=mock is always available — check MockLMConfig',
};

export const withHint = (message: string, provider?: string): string => {
  const hint = provider ? LADDER_HINTS[provider.split('.')[0] ?? ''] : undefined;
  return hint ? `${message} — hint: ${hint}` : message;
};

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

const CACHE_TTL_MS = 60_000;

/** H3/X15: per-provider cumulative spend. */
export interface ProviderSpend {
  tokensIn: number;
  tokensOut: number;
  calls: number;
  /** Cumulative cost in milli-dollars (MODEL_CAPABILITIES.costPerMTok × tokens). */
  costMilli: number;
}

const spendCapUsd = (): number | undefined => {
  const raw = process.env.LM_MAX_SPEND_USD;
  if (!raw) return undefined;
  const v = Number(raw);
  return Number.isFinite(v) && v > 0 ? v : undefined;
};

function hashKey(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

function buildCacheKey(prompt: string, options?: { task?: LMTask; temperature?: number; maxOutputTokens?: number; grammar?: string; model?: string }): string {
  const parts = [
    prompt,
    options?.task ?? 'fast',
    options?.temperature ?? 0,
    options?.maxOutputTokens ?? 0,
    options?.grammar ?? '',
    options?.model ?? '',
  ];
  return hashKey(parts.join('|'));
}

/** Run fn under a GBNF grammar scope when one is provided (no-op otherwise).
 * Grammar names ('narsese-term', 'single-word') resolve to their shipped GBNF text;
 * raw GBNF passes through untouched. */
const runInGrammarScope = <T>(grammar: string | undefined, fn: () => Promise<T>): Promise<T> => {
  if (!grammar) return fn();
  const gbnf = NAMED_GRAMMARS.has(grammar as GrammarName) ? loadGrammar(grammar as GrammarName) : grammar;
  return runWithGrammar(gbnf, fn);
};

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
    withHint(
      `LM provider unavailable (${provider ?? 'unknown'}): ${(lastError as Error)?.message ?? String(lastError)}`,
      provider
    ),
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

import type { ILMService } from './interfaces.js';

export class LMService implements ILMService {
  readonly stats: LMExecutionStats = createLMStats();
  private reprobeDone = false;
  /** Consecutive transport failures per resolved model id → demotion (R5). */
  private failures = new Map<string, number>();
  /** Per-model-id execution stats feeding stats-aware chain reordering (R4/R5). */
  private perModel = new Map<string, LMExecutionStats>();
  /** Optional progress callback for transformers.js model downloads. */
  private progressCallback: ModelDownloadProgressCallback | undefined;
  /** Prompt-hash-keyed semantic cache with 60s TTL. Cleared on failure so retries re-populate. */
  private cache = new Map<string, CacheEntry>();
  /** H3: per-provider spend ledger (token totals from AI-SDK usage + capability table). */
  private spend = new Map<string, ProviderSpend>();

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

  private getCached(key: string): string | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  private setCache(key: string, value: string): void {
    // D16: bounded memory without a timer — each write sweeps expired entries.
    const now = Date.now();
    if (this.cache.size > 0) {
      for (const [k, entry] of this.cache) {
        if (now > entry.expiresAt) this.cache.delete(k);
      }
    }
    this.cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
  }

  private clearCache(key: string): void {
    this.cache.delete(key);
  }

  /** Active SeNARS provider name (CHAINS key). Raw model providers don't always
   *  match (e.g. transformers-js → transformers, cloud → configured cloud provider). */
  get provider(): string | undefined {
    const raw = (this.getModel('quality') as { provider?: string } | undefined)?.provider;
    if (!raw) return getLmProvider();
    // AI SDK may suffix provider names (e.g. 'llamacpp.chat') — normalize.
    const normalized = raw.split('.')[0] ?? raw;
    const configured = getLmProvider();
    const map: Partial<Record<string, LMProviderName>> = {
      'transformers-js': 'transformers',
      ollama: 'ollama',
      llamacpp: 'llamacpp',
      mock: 'mock',
      webllm: 'webllm',
      cloud: configured,
    };
    return map[normalized] ?? (normalized as LMProviderName) ?? configured;
  }

  get model(): string | undefined {
    const model = this.getModel('quality');
    return (model as { modelId?: string })?.modelId;
  }

  get available(): boolean {
    return this.hasModel();
  }

  getModel(task: LMTask, modelOverride?: string): LanguageModel | undefined {
    try {
      return getModelForTask(this.registry, task, undefined, this.getModelStats(), modelOverride) as LanguageModel;
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

  /** H3: cumulative per-provider spend ledger. */
  getSpend(): Record<string, ProviderSpend> {
    return Object.fromEntries(this.spend);
  }

  /** H3: record usage tokens + capability-table cost against the provider; throws
   *  LMUnavailableError (with remediation) once LM_MAX_SPEND_USD is exceeded. */
  private recordSpend(
    provider: string,
    task: LMTask,
    tokensIn: number,
    tokensOut: number
  ): void {
    const entry = this.spend.get(provider) ?? { tokensIn: 0, tokensOut: 0, calls: 0, costMilli: 0 };
    entry.tokensIn += tokensIn;
    entry.tokensOut += tokensOut;
    entry.calls += 1;
    const cap = getModelCapability(getLastRoutingDecision()?.modelId ?? '')?.costPerMTok ?? 0;
    const costMilli = ((tokensIn + tokensOut) / 1_000_000) * cap * 1000;
    entry.costMilli += costMilli;
    this.spend.set(provider, entry);
    recordLmSpend(provider, tokensIn + tokensOut, costMilli);

    const capUsd = spendCapUsd();
    if (capUsd !== undefined && entry.costMilli / 1000 > capUsd) {
      throw new LMUnavailableError(
        `Spend cap reached for provider '${provider}': $${(entry.costMilli / 1000).toFixed(4)} >= LM_MAX_SPEND_USD=$${capUsd}. ` +
          `Raise LM_MAX_SPEND_USD, switch to a local provider (LM_PROVIDER=mock|transformers), or set LM_OFFLINE=1.`,
        provider,
        task
      );
    }
  }

  async generateText(
    prompt: string,
    opts?: {
      task?: LMTask;
      signal?: AbortSignal;
      temperature?: number;
      maxOutputTokens?: number;
      /** H2: explicit per-call model id (e.g. 'cloud:quality') — bypasses the routing chain. */
      model?: string;
      /** GBNF grammar for constrained decoding (llamacpp provider). */
      grammar?: string;
    }
  ): Promise<string> {
    const model = this.getModel(opts?.task ?? 'fast', opts?.model);
    if (!model) throw new Error('No model available');

    const provider = this.provider as LMProviderName | undefined;
    const settings = getLMSettings();
    if (provider && !canUseProvider(provider, settings)) {
      throw new LMUnavailableError(
        withHint(`Circuit breaker open for provider: ${provider}`, provider),
        provider,
        opts?.task
      );
    }

    const cacheKey = buildCacheKey(prompt, {
      task: opts?.task,
      temperature: opts?.temperature,
      maxOutputTokens: opts?.maxOutputTokens,
      grammar: opts?.grammar,
      model: opts?.model,
    });
    const cached = this.getCached(cacheKey);
    if (cached) {
      this.recordCall(true, Date.now(), prompt.length + cached.length);
      if (provider) recordProviderCall(provider, true, settings);
      return cached;
    }

    const start = Date.now();
    const task = opts?.task ?? 'fast';
    try {
      const text = await runInGrammarScope(
        opts?.grammar,
        async () =>
          await withRetry(
            async () => {
              const { text: out, usage } = await generateText({
                model,
                prompt,
                abortSignal: opts?.signal,
                temperature: opts?.temperature,
                maxOutputTokens: opts?.maxOutputTokens,
              });
              this.recordSpend(
                provider ?? 'unknown',
                task,
                usage?.inputTokens ?? 0,
                usage?.outputTokens ?? 0
              );
              return out;
            },
            provider,
            task
          )
      );
      this.setCache(cacheKey, text);
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
      this.clearCache(cacheKey);
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

  /** Universal LLM failure escalation: attempt → retry once at temp+0.2 → null.
   *  Callers activate their pure-NAL symbolic fallback on null. */
  async tryGenerateText(
    prompt: string,
    opts?: Parameters<LMService['generateText']>[1]
  ): Promise<string | null> {
    if (opts?.signal?.aborted) return null;
    try {
      return await this.generateText(prompt, opts);
    } catch {
      if (opts?.signal?.aborted) return null;
      try {
        return await this.generateText(prompt, {
          ...opts,
          temperature: (opts?.temperature ?? 0) + 0.2,
        });
      } catch {
        return null;
      }
    }
  }

  async generateObject<T>(
    prompt: string,
    schema: ZodSchema<T>,
    opts?: {
      task?: LMTask;
      signal?: AbortSignal;
      temperature?: number;
      /** H2: explicit per-call model id (e.g. 'cloud:quality') — bypasses the routing chain. */
      model?: string;
    }
  ): Promise<T> {
    try {
      return await this.generateObjectNative(prompt, schema, opts);
    } catch (nativeError) {
      // Structured-output adapters break across providers/zod versions — fall
      // back to a real-LM JSON-mode round trip (no mock, no placeholder).
      return await this.generateObjectViaText(prompt, schema, opts, nativeError);
    }
  }

  private async generateObjectNative<T>(
    prompt: string,
    schema: ZodSchema<T>,
    opts?: { task?: LMTask; signal?: AbortSignal; temperature?: number; model?: string }
  ): Promise<T> {
    const model = this.getModel(opts?.task ?? 'structured', opts?.model);
    if (!model) throw new Error('No model available');

    const provider = this.provider as LMProviderName | undefined;
    const settings = getLMSettings();
    if (provider && !canUseProvider(provider, settings)) {
      throw new LMUnavailableError(`Circuit breaker open for provider: ${provider}`, provider, opts?.task);
    }

    const cacheKey = buildCacheKey(prompt, {
      task: opts?.task ?? 'structured',
      temperature: opts?.temperature ?? 0,
      maxOutputTokens: 0,
      grammar: JSON.stringify(schema),
      model: opts?.model,
    });
    const cached = this.getCached(cacheKey);
    if (cached) {
      this.recordCall(true, Date.now(), prompt.length + cached.length);
      if (provider) recordProviderCall(provider, true, settings);
      return JSON.parse(cached) as T;
    }

    const start = Date.now();
    const task = opts?.task ?? 'structured';
    try {
      const object = await withRetry(
        async () => {
          const { object: out, usage } = await generateObject({
            model,
            prompt,
            schema: zodSchema(schema),
            temperature: opts?.temperature,
            abortSignal: opts?.signal,
          });
          this.recordSpend(
            provider ?? 'unknown',
            task,
            usage?.inputTokens ?? 0,
            usage?.outputTokens ?? 0
          );
          return out;
        },
        provider,
        task
      );
      const jsonStr = JSON.stringify(object);
      this.setCache(cacheKey, jsonStr);
      this.recordCall(true, start, prompt.length + jsonStr.length);
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
      this.clearCache(cacheKey);
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

  /** JSON-mode structured generation over plain text: schema in the prompt,
   *  first JSON object extracted, validated against the zod schema. */
  private async generateObjectViaText<T>(
    prompt: string,
    schema: ZodSchema<T>,
    opts: { task?: LMTask; signal?: AbortSignal; temperature?: number; model?: string } | undefined,
    nativeError: unknown
  ): Promise<T> {
    const jsonSchema = z.toJSONSchema(schema as never);
    const enriched =
      `${prompt}\n\nRespond with ONLY a single JSON object matching this JSON Schema` +
      ` (no markdown fences, no commentary):\n${JSON.stringify(jsonSchema)}`;
    const base = opts?.temperature ?? 0;
    const temperatures = base === 0 ? [0, 0.2] : [base, base + 0.3];
    let lastError: unknown = nativeError;
    for (const temperature of temperatures) {
      if (opts?.signal?.aborted) break;
      try {
        const text = await this.generateText(enriched, {
          task: opts?.task ?? 'structured',
          signal: opts?.signal,
          temperature,
          model: opts?.model,
        });
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('No JSON object in LM response');
        return schema.parse(JSON.parse(match[0]));
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  async *stream(
    prompt: string,
    opts?: {
      task?: LMTask;
      signal?: AbortSignal;
    }
  ): AsyncIterable<string> {
    const model = this.getModel(opts?.task ?? 'fast');
    // D5: stream parity — no silent success when no model resolves.
    if (!model) {
      throw new LMUnavailableError(
        'No model available for task: ' + (opts?.task ?? 'fast'),
        this.provider as LMProviderName | undefined,
        opts?.task
      );
    }

    // F6/X22: stream path shares the generate path's failure semantics.
    const provider = this.provider as LMProviderName | undefined;
    const settings = getLMSettings();
    if (provider && !canUseProvider(provider, settings)) {
      throw new LMUnavailableError(
        withHint(`Circuit breaker open for provider: ${provider}`, provider),
        provider,
        opts?.task
      );
    }

    const cacheKey = buildCacheKey(prompt, { task: opts?.task ?? 'fast' });
    const cached = this.getCached(cacheKey);
    if (cached) {
      this.recordCall(true, Date.now(), prompt.length + cached.length);
      if (provider) recordProviderCall(provider, true, settings);
      yield cached;
      return;
    }

    const start = Date.now();
    const task = opts?.task ?? 'fast';
    let out = 0;
    let yielded = false;
    let lastError: unknown;
    // D5: one silent retry only if the stream failed before any chunk was
    // yielded (post-yield retries would duplicate output).
    for (let attempt = 0; attempt < 2 && !yielded; attempt++) {
      try {
        const result = streamText({ model, prompt, abortSignal: opts?.signal });
        for await (const chunk of result.textStream) {
          yielded = true;
          out += chunk.length;
          yield chunk;
        }
        // D5: stream pays the same spend toll as generate.
        const usage = await result.usage;
        this.recordSpend(provider ?? 'unknown', task, usage?.inputTokens ?? 0, usage?.outputTokens ?? 0);
        this.setCache(cacheKey, (await result.text) || '');
        this.recordCall(true, start, prompt.length + out);
        if (provider) recordProviderCall(provider, true, settings);
        this.noteSuccess();
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
        return;
      } catch (e) {
        lastError = e;
        this.recordCall(false, start, prompt.length + out);
        if (provider) recordProviderCall(provider, false, settings);
        if (isTransportError(e)) {
          this.noteFailure();
          await this.reprobe();
        }
        if (yielded) throw e;
      }
    }
    throw lastError;
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

  getSpend(): Record<string, ProviderSpend> {
    return {};
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
