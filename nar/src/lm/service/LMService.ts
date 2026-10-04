import {
  type LMExecutionStats,
  type LMGenerateOptions,
  type LMTask,
  stopwatch,
} from '@senars/util';
import { generateObject, generateText, type LanguageModel, streamText, zodSchema } from 'ai';
import type { ZodSchema } from 'zod';
import { z } from 'zod';
import { withSpan } from '../../otel/index.js';
import type { ILMService } from '../interfaces.js';
import { toCachedJsonSchema } from '../json.js';
import { getProviderRuntime, type ProviderRuntime } from '../provider-runtime.js';
import type {
  LMProviderName,
  ModelDownloadProgressCallback,
  SeNARSRegistry,
} from '../providers.js';
import {
  createSeNARSRegistry,
  getLMSettings,
  getLmProvider,
  getModelForTask,
  resolveActiveProvider,
  setBuiltinProgressCallback,
} from '../providers.js';
import { CallAccounting, type CallEnvelope, type Gate, textCodec } from './accounting.js';
import { buildCacheKey } from './cache.js';
import { LMUnavailableError, temperatureLadder } from './errors.js';
import { enforceLMOutputSize, LMOutputTooLargeError, maxLMOutputChars } from './sanitize.js';
import type { ProviderSpend } from './spend.js';
import { generateObjectViaText } from './structured.js';

/** AI SDK model provider ids → SeNARS CHAINS keys. */
const PROVIDER_ALIASES: Readonly<Record<string, LMProviderName>> = Object.freeze({
  'transformers-js': 'transformers',
  ollama: 'openai-compatible',
  llamacpp: 'llamacpp',
  mock: 'mock',
  webllm: 'webllm',
});

/** Per-call structured-generation options. */
interface ObjectOptions {
  task?: LMTask;
  signal?: AbortSignal;
  temperature?: number;
  /** H2: explicit per-call model id (e.g. 'cloud:quality') — bypasses the routing chain. */
  model?: string;
}

/** Cached form of a structured result. */
const jsonCodec = {
  encode: (value: unknown) => JSON.stringify(value),
  decode: <T>(raw: string): T => JSON.parse(raw) as T,
};

export class LMService implements ILMService {
  private registry: SeNARSRegistry;
  private reprobeDone = false;
  /** Optional progress callback for transformers.js model downloads. */
  private progressCallback: ModelDownloadProgressCallback | undefined;
  /** Breaker gate + cache + spend + stats + routing telemetry + demotion. */
  private readonly accounting: CallAccounting;

  constructor(
    registry: SeNARSRegistry,
    progressCallback?: ModelDownloadProgressCallback,
    providerRuntime = getProviderRuntime()
  ) {
    this.registry = registry;
    this.progressCallback = progressCallback;
    this.accounting = new CallAccounting(providerRuntime, () => this.reprobe());
    if (progressCallback) setBuiltinProgressCallback(progressCallback);
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
    const configured = getLmProvider();
    // AI SDK may suffix provider names (e.g. 'llamacpp.chat') — normalize.
    const normalized = raw?.split('.')[0] ?? raw;
    if (!normalized) return configured;
    return (
      (normalized === 'cloud' ? configured : PROVIDER_ALIASES[normalized]) ??
      (normalized as LMProviderName)
    );
  }

  get model(): string | undefined {
    return (this.getModel('quality') as { modelId?: string } | undefined)?.modelId;
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
        this.accounting.perModel,
        modelOverride,
        this.accounting.runtime
      ) as LanguageModel;
    } catch {
      return undefined;
    }
  }

  hasModel(): boolean {
    return !!this.getModel('fast');
  }

  getStats(): LMExecutionStats {
    return { ...this.accounting.stats };
  }

  /** H3: cumulative per-provider spend ledger. */
  getSpend(): Record<string, ProviderSpend> {
    return this.accounting.getSpend();
  }

  /** Get circuit breaker status for all providers. */
  getCircuitBreakerStatus(): Map<string, ReturnType<ProviderRuntime['getCircuitBreaker']>> {
    return this.accounting.runtime.getAllCircuitBreakers();
  }

  async generateText(
    prompt: string,
    opts?: Parameters<LMService['generateTextInner']>[1]
  ): Promise<string> {
    return withSpan('lm.generate_text', { 'lm.task': opts?.task ?? 'fast' }, async (span) => {
      const elapsed = stopwatch();
      const text = enforceLMOutputSize(await this.generateTextInner(prompt, opts));
      span.setAttributes({ 'lm.latency_ms': elapsed(), 'lm.output_chars': text.length });
      return text;
    });
  }

  private async generateTextInner(prompt: string, opts?: LMGenerateOptions): Promise<string> {
    const task = opts?.task ?? 'fast';
    const { model, gate } = this.open(task, opts?.model);
    return this.accounting.execute<string>(
      {
        task,
        prompt,
        grammar: opts?.grammar,
        ...textCodec,
        cacheKey: buildCacheKey(prompt, { ...opts, task }),
        run: async ({ report }) => {
          const { text, usage } = await generateText({
            model,
            prompt,
            abortSignal: opts?.signal,
            temperature: opts?.temperature,
            maxOutputTokens: opts?.maxOutputTokens,
          });
          report(usage);
          return text;
        },
      },
      gate
    );
  }

  /** Universal LLM failure escalation: attempt → retry once at `temperatureLadder`'s top rung → null.
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
      return this.generateText(prompt, {
        ...opts,
        temperature: temperatureLadder(opts?.temperature ?? 0)[1]!,
      }).catch(() => null);
    }
  }

  async generateObject<T>(prompt: string, schema: ZodSchema<T>, opts?: ObjectOptions): Promise<T> {
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
    opts?: ObjectOptions
  ): Promise<T> {
    const task = opts?.task ?? 'structured';
    const { model, gate } = this.open(task, opts?.model);
    return this.accounting.execute<T>(
      {
        task,
        prompt,
        ...jsonCodec,
        cacheKey: buildCacheKey(prompt, {
          task,
          temperature: opts?.temperature ?? 0,
          maxOutputTokens: 0,
          grammar: JSON.stringify(toCachedJsonSchema(schema)),
          model: opts?.model,
        }),
        run: async ({ report }) => {
          const { object, usage } = await generateObject({
            model,
            prompt,
            schema: zodSchema(schema),
            temperature: opts?.temperature,
            abortSignal: opts?.signal,
          });
          report(usage);
          return object as T;
        },
      },
      gate
    );
  }

  async *stream(
    prompt: string,
    opts?: Pick<LMGenerateOptions, 'task' | 'signal'>
  ): AsyncIterable<string> {
    const task = opts?.task ?? 'fast';
    // D5: stream parity — no silent success when no model resolves.
    const { model, gate } = this.open(task);
    const envelope: CallEnvelope<string> = {
      task,
      prompt,
      ...textCodec,
      cacheKey: buildCacheKey(prompt, { task }),
    };

    // F6/X22: stream path shares the generate path's failure semantics.
    const cached = this.accounting.lookup(envelope, gate);
    if (cached.hit) {
      yield cached.value;
      return;
    }

    const elapsed = stopwatch();
    const outputLimit = maxLMOutputChars();
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
          if (out > outputLimit) throw new LMOutputTooLargeError(out, outputLimit);
          yield chunk;
        }
        // D5: stream pays the same spend toll as generate.
        this.accounting.bill(task, gate, await result.usage);
        await this.accounting.settle(envelope, elapsed(), gate, {
          ok: true,
          value: (await result.text) || '',
          tokens: prompt.length + out,
        });
        return;
      } catch (error) {
        lastError = error;
        await this.accounting.settle(envelope, elapsed(), gate, {
          ok: false,
          error,
          committed: yielded,
          tokens: prompt.length + out,
        });
        if (yielded) throw error;
      }
    }
    throw lastError;
  }

  /** Resolve the active model and pass the breaker gate; fail closed. */
  private open(task: LMTask, modelOverride?: string): { model: LanguageModel; gate: Gate } {
    const model = this.getModel(task, modelOverride);
    if (!model) {
      throw new LMUnavailableError(
        `No model available for task: ${task}`,
        this.provider as LMProviderName,
        task
      );
    }
    return { model, gate: this.accounting.gate(task, this.provider as LMProviderName) };
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
}

export function createLMService(options?: { providerRuntime?: ProviderRuntime }): LMService {
  return new LMService(createSeNARSRegistry(), undefined, options?.providerRuntime);
}
