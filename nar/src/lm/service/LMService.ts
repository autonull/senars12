import type { LMExecutionStats, LMTask } from '@senars/util';
import { generateObject, generateText, type LanguageModel, streamText, zodSchema } from 'ai';
import { trace } from '@opentelemetry/api';
import { withSpan } from '../../otel/index.js';
import type { ZodSchema } from 'zod';
import { z } from 'zod';
import type { GrammarName } from '../grammars/index.js';
import { loadGrammar } from '../grammars/index.js';
import type { ILMService } from '../interfaces.js';
import { getProviderRuntime, type ProviderRuntime } from '../provider-runtime.js';
import { runWithGrammar } from '../providers/llamacpp.js';
import type { SeNARSRegistry } from '../providers.js';
import {
  createSeNARSRegistry,
  getLMSettings,
  getLmProvider,
  getModelChain,
  getModelForTask,
  type LMProviderName,
  type ModelDownloadProgressCallback,
  resolveActiveProvider,
  setBuiltinProgressCallback,
} from '../providers.js';
import { createLMStats, recordLMCall } from '../stats.js';
import { buildCacheKey, ResponseCache } from './cache.js';
import { isTransportError, LMUnavailableError, withHint, withRetry } from './errors.js';
import { enforceLMOutputSize, LMOutputTooLargeError, maxLMOutputChars } from './sanitize.js';
import { type ProviderSpend, SpendLedger } from './spend.js';
import { generateObjectViaText } from './structured.js';

const NAMED_GRAMMARS: ReadonlySet<string> = new Set<string>(['narsese-term', 'single-word']);

/** Run fn under a GBNF grammar scope when one is provided (no-op otherwise).
 * Grammar names ('narsese-term', 'single-word') resolve to their shipped GBNF text;
 * raw GBNF passes through untouched. */
const runInGrammarScope = <T>(grammar: string | undefined, fn: () => Promise<T>): Promise<T> => {
  if (!grammar) return fn();
  const gbnf = NAMED_GRAMMARS.has(grammar as GrammarName)
    ? loadGrammar(grammar as GrammarName)
    : grammar;
  return runWithGrammar(gbnf, fn);
};

export class LMService implements ILMService {
  private stats: LMExecutionStats = createLMStats();
  private reprobeDone = false;
  /** Consecutive transport failures per resolved model id → demotion (R5). */
  private failures = new Map<string, number>();
  /** Per-model-id execution stats feeding stats-aware chain reordering (R4/R5). */
  private perModel = new Map<string, LMExecutionStats>();
  /** Optional progress callback for transformers.js model downloads. */
  private progressCallback: ModelDownloadProgressCallback | undefined;
  /** Prompt-hash-keyed semantic cache with 60s TTL. Cleared on failure so retries re-populate. */
  private readonly cache = new ResponseCache();
  /** H3: per-provider spend ledger (token totals from AI-SDK usage + capability table). */
  private readonly ledger = new SpendLedger();

  /** Scoped provider routing/breaker state — defaults to the process-wide instance. */
  private readonly runtime: ProviderRuntime;

  constructor(
    private registry: SeNARSRegistry,
    progressCallback?: ModelDownloadProgressCallback,
    providerRuntime?: ProviderRuntime
  ) {
    this.runtime = providerRuntime ?? getProviderRuntime();
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
      ollama: 'openai-compatible',
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
      return getModelForTask(
        this.registry,
        task,
        undefined,
        this.getModelStats(),
        modelOverride,
        this.runtime
      ) as LanguageModel;
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
    return this.ledger.snapshot();
  }

  async generateText(
    prompt: string,
    opts?: Parameters<LMService['generateTextInner']>[1]
  ): Promise<string> {
    return withSpan('lm.generate_text', { 'lm.task': opts?.task ?? 'fast' }, async (span) => {
      const start = Date.now();
      const text = enforceLMOutputSize(await this.generateTextInner(prompt, opts));
      span.setAttributes({ 'lm.latency_ms': Date.now() - start, 'lm.output_chars': text.length });
      return text;
    });
  }

  private async generateTextInner(
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
    if (provider && !this.runtime.canUseProvider(provider, settings)) {
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
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.recordCall(true, Date.now(), prompt.length + cached.length);
      if (provider) this.runtime.recordProviderCall(provider, true, settings);
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
      this.cache.set(cacheKey, text);
      this.recordCall(true, start, prompt.length + text.length);
      if (provider) this.runtime.recordProviderCall(provider, true, settings);
      this.noteSuccess();
      this.logRoutingDecision(task, start, true, provider);
      return text;
    } catch (e) {
      this.cache.clear(cacheKey);
      this.recordCall(false, start, prompt.length);
      if (provider) this.runtime.recordProviderCall(provider, false, settings);
      if (isTransportError(e)) {
        this.noteFailure();
        await this.reprobe();
      }
      this.logRoutingDecision(task, start, false, provider);
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
      return await generateObjectViaText(
        (p, o) => this.generateText(p, o),
        prompt,
        schema,
        opts,
        nativeError
      );
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
    if (provider && !this.runtime.canUseProvider(provider, settings)) {
      throw new LMUnavailableError(
        `Circuit breaker open for provider: ${provider}`,
        provider,
        opts?.task
      );
    }

    const cacheKey = buildCacheKey(prompt, {
      task: opts?.task ?? 'structured',
      temperature: opts?.temperature ?? 0,
      maxOutputTokens: 0,
      grammar: JSON.stringify(schema),
      model: opts?.model,
    });
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.recordCall(true, Date.now(), prompt.length + cached.length);
      if (provider) this.runtime.recordProviderCall(provider, true, settings);
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
      this.cache.set(cacheKey, jsonStr);
      this.recordCall(true, start, prompt.length + jsonStr.length);
      if (provider) this.runtime.recordProviderCall(provider, true, settings);
      this.logRoutingDecision(task, start, true, provider);
      return object;
    } catch (e) {
      this.cache.clear(cacheKey);
      this.recordCall(false, start, prompt.length);
      if (provider) this.runtime.recordProviderCall(provider, false, settings);
      if (isTransportError(e)) await this.reprobe();
      this.logRoutingDecision(task, start, false, provider);
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
    // D5: stream parity — no silent success when no model resolves.
    if (!model) {
      throw new LMUnavailableError(
        `No model available for task: ${opts?.task ?? 'fast'}`,
        this.provider as LMProviderName | undefined,
        opts?.task
      );
    }

    // F6/X22: stream path shares the generate path's failure semantics.
    const provider = this.provider as LMProviderName | undefined;
    const settings = getLMSettings();
    if (provider && !this.runtime.canUseProvider(provider, settings)) {
      throw new LMUnavailableError(
        withHint(`Circuit breaker open for provider: ${provider}`, provider),
        provider,
        opts?.task
      );
    }

    const cacheKey = buildCacheKey(prompt, { task: opts?.task ?? 'fast' });
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.recordCall(true, Date.now(), prompt.length + cached.length);
      if (provider) this.runtime.recordProviderCall(provider, true, settings);
      yield cached;
      return;
    }

    const start = Date.now();
    const task = opts?.task ?? 'fast';
    let out = 0;
    let yielded = false;
    let lastError: unknown;
    const outputLimit = maxLMOutputChars();
    // D5: one silent retry only if the stream failed before any chunk was
    // yielded (post-yield retries would duplicate output).
    for (let attempt = 0; attempt < 2 && !yielded; attempt++) {
      try {
        const result = streamText({ model, prompt, abortSignal: opts?.signal });
        for await (const chunk of result.textStream) {
          yielded = true;
          out += chunk.length;
          if (out > outputLimit) throw new LMOutputTooLargeError(out, outputLimit);
          yield chunk;
        }
        // D5: stream pays the same spend toll as generate.
        const usage = await result.usage;
        this.recordSpend(
          provider ?? 'unknown',
          task,
          usage?.inputTokens ?? 0,
          usage?.outputTokens ?? 0
        );
        this.cache.set(cacheKey, (await result.text) || '');
        this.recordCall(true, start, prompt.length + out);
        if (provider) this.runtime.recordProviderCall(provider, true, settings);
        this.noteSuccess();
        this.logRoutingDecision(task, start, true, provider);
        return;
      } catch (e) {
        lastError = e;
        this.recordCall(false, start, prompt.length + out);
        if (provider) this.runtime.recordProviderCall(provider, false, settings);
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

  private logRoutingDecision(
    task: LMTask,
    start: number,
    success: boolean,
    provider: LMProviderName | undefined
  ): void {
    trace.getActiveSpan()?.setAttributes({
      'lm.provider': provider ?? 'unknown',
      'lm.model': this.runtime.lastDecision?.modelId ?? '',
      'lm.success': success,
      'lm.latency_ms': Date.now() - start,
    });
    const decision = this.runtime.lastDecision;
    if (!decision) return;
    this.runtime.logRoutingDecision({
      ts: Date.now(),
      task,
      modelId: decision.modelId,
      latencyMs: Date.now() - start,
      success,
      demoted: success && decision.reason === 'failover',
      provider: provider ?? 'unknown',
      chain: getModelChain(provider ?? getLmProvider(), task, this.runtime),
    });
  }

  private recordSpend(provider: string, task: LMTask, tokensIn: number, tokensOut: number): void {
    this.ledger.record(provider, task, this.runtime.lastDecision?.modelId, tokensIn, tokensOut);
  }

  private recordCall(success: boolean, start: number, tokens: number): void {
    recordLMCall(this.stats, success, Date.now() - start, tokens);
    const id = this.runtime.lastDecision?.modelId;
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
    const id = this.runtime.lastDecision?.modelId;
    if (id) this.failures.delete(id);
  }

  private noteFailure(): void {
    const id = this.runtime.lastDecision?.modelId;
    if (!id) return;
    const n = (this.failures.get(id) ?? 0) + 1;
    this.failures.set(id, n);
    if (n >= 2) this.runtime.demoteModel(id, `repeated transport failures (${n})`);
  }

  /** Get circuit breaker status for all providers. */
  getCircuitBreakerStatus(): Map<string, ReturnType<ProviderRuntime['getCircuitBreaker']>> {
    return this.runtime.getAllCircuitBreakers();
  }
}

export function createLMService(options?: { providerRuntime?: ProviderRuntime }): LMService {
  const registry = createSeNARSRegistry();
  return new LMService(registry, undefined, options?.providerRuntime);
}
