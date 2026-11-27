import { stopwatch } from '@senars/util/async';
import { generateObject, generateText, streamText, zodSchema } from 'ai';
import { withSpan } from '../../otel/index';
import { toCachedJsonSchema } from '../json';
import { getProviderRuntime } from '../provider-runtime';
import { LM_PROVIDER_NAMES } from '../env-config';
import { createSeNARSRegistry, getLMSettings, getLmProvider, getModelForTask, resolveActiveProvider, setBuiltinProgressCallback, } from '../providers';
import { CallAccounting, textCodec } from './accounting';
import { buildCacheKey } from './cache';
import { LMUnavailableError, temperatureLadder } from './errors';
import { enforceLMOutputSize, LMOutputTooLargeError, maxLMOutputChars } from './sanitize';
import { generateObjectViaText } from './structured';
/** AI SDK model provider ids → SeNARS CHAINS keys. */
const PROVIDER_ALIASES = Object.freeze({
    'transformers-js': 'transformers',
    ollama: 'openai-compatible',
    llamacpp: 'llamacpp',
    mock: 'mock',
    webllm: 'webllm',
});
/**
 * Provider id → the `createSeNARSRegistry` key its models live under. Several
 * chameleon providers share one registry namespace (`builtin`, `cloud`), which
 * is also why availability is probed per provider id below.
 */
const REGISTRY_KEY = Object.freeze({
    transformers: 'builtin',
    mock: 'builtin',
    anthropic: 'cloud',
    openai: 'cloud',
    'openai-compatible': 'cloud',
    llamacpp: 'llamacpp',
    'llamacpp-embedded': 'llamacpp-embedded',
    webllm: 'webllm',
});
/** Cached form of a structured result. */
const jsonCodec = {
    encode: (value) => JSON.stringify(value),
    decode: (raw) => JSON.parse(raw),
};
export class LMService {
    registry;
    reprobeDone = false;
    /** Optional progress callback for transformers.js model downloads. */
    progressCallback;
    /** Breaker gate + cache + spend + stats + routing telemetry + demotion. */
    accounting;
    constructor(registry, progressCallback, providerRuntime = getProviderRuntime()) {
        this.registry = registry;
        this.progressCallback = progressCallback;
        this.accounting = new CallAccounting(providerRuntime, () => this.reprobe());
        if (progressCallback)
            setBuiltinProgressCallback(progressCallback);
    }
    /** Set or update the model download progress callback. */
    setProgressCallback(cb) {
        this.progressCallback = cb;
        setBuiltinProgressCallback(cb);
    }
    /** Active SeNARS provider name (CHAINS key). Raw model providers don't always
     *  match (e.g. transformers-js → transformers, cloud → configured cloud provider). */
    get provider() {
        const raw = this.getModel('quality')?.provider;
        const configured = getLmProvider();
        // AI SDK may suffix provider names (e.g. 'llamacpp.chat') — normalize.
        const normalized = raw?.split('.')[0] ?? raw;
        if (!normalized)
            return configured;
        return ((normalized === 'cloud' ? configured : PROVIDER_ALIASES[normalized]) ??
            normalized);
    }
    get model() {
        return this.getModel('quality')?.modelId;
    }
    get available() {
        return this.hasModel();
    }
    /** The runtime-active provider selection, or undefined when env/config decides. */
    getActiveProvider() {
        return this.accounting.runtime.getActiveProvider();
    }
    /**
     * Switch the runtime-active provider (and optional model). Instant: every
     * configured provider is already in the registry, so this only re-points the
     * default chain — no rebuild, and other providers stay usable concurrently
     * via a per-call model id.
     */
    selectProvider(provider, model) {
        this.accounting.runtime.setActiveProvider(provider, model);
        this.reprobeDone = false;
    }
    /** Which providers the registry can answer for, keyed by provider id. */
    getCatalog() {
        return LM_PROVIDER_NAMES.map((id) => {
            const key = REGISTRY_KEY[id];
            let available = false;
            try {
                this.registry.languageModel(`${key}:fast`);
                available = true;
            }
            catch {
                available = false;
            }
            return { id, available };
        });
    }
    getModel(task, modelOverride) {
        try {
            return getModelForTask(this.registry, task, undefined, this.accounting.perModel, modelOverride, this.accounting.runtime);
        }
        catch {
            return undefined;
        }
    }
    hasModel() {
        return !!this.getModel('fast');
    }
    getStats() {
        return { ...this.accounting.stats };
    }
    /** H3: cumulative per-provider spend ledger. */
    getSpend() {
        return this.accounting.getSpend();
    }
    /** Get circuit breaker status for all providers. */
    getCircuitBreakerStatus() {
        return this.accounting.runtime.getAllCircuitBreakers();
    }
    async generateText(prompt, opts) {
        return withSpan('lm.generate_text', { 'lm.task': opts?.task ?? 'fast' }, async (span) => {
            const elapsed = stopwatch();
            const text = enforceLMOutputSize(await this.generateTextInner(prompt, opts));
            span.setAttributes({ 'lm.latency_ms': elapsed(), 'lm.output_chars': text.length });
            return text;
        });
    }
    async generateTextInner(prompt, opts) {
        const task = opts?.task ?? 'fast';
        const { model, gate } = this.open(task, opts?.model);
        return this.accounting.execute({
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
        }, gate);
    }
    /** Universal LLM failure escalation: attempt → retry once at `temperatureLadder`'s top rung → null.
     *  Callers activate their pure-NAL symbolic fallback on null. */
    async tryGenerateText(prompt, opts) {
        if (opts?.signal?.aborted)
            return null;
        try {
            return await this.generateText(prompt, opts);
        }
        catch {
            if (opts?.signal?.aborted)
                return null;
            return this.generateText(prompt, {
                ...opts,
                temperature: temperatureLadder(opts?.temperature ?? 0)[1],
            }).catch(() => null);
        }
    }
    async generateObject(prompt, schema, opts) {
        try {
            return await this.generateObjectNative(prompt, schema, opts);
        }
        catch (nativeError) {
            // Structured-output adapters break across providers/zod versions — fall
            // back to a real-LM JSON-mode round trip (no mock, no placeholder).
            return await generateObjectViaText((p, o) => this.generateText(p, o), prompt, schema, opts, nativeError);
        }
    }
    async generateObjectNative(prompt, schema, opts) {
        const task = opts?.task ?? 'structured';
        const { model, gate } = this.open(task, opts?.model);
        return this.accounting.execute({
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
                return object;
            },
        }, gate);
    }
    async *stream(prompt, opts) {
        const task = opts?.task ?? 'fast';
        // D5: stream parity — no silent success when no model resolves.
        const { model, gate } = this.open(task);
        const envelope = {
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
        let lastError;
        // D5: one silent retry only if the stream failed before any chunk was
        // yielded (post-yield retries would duplicate output).
        for (let attempt = 0; attempt < 2 && !yielded; attempt++) {
            try {
                const result = streamText({ model, prompt, abortSignal: opts?.signal });
                for await (const chunk of result.textStream) {
                    yielded = true;
                    out += chunk.length;
                    if (out > outputLimit)
                        throw new LMOutputTooLargeError(out, outputLimit);
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
            }
            catch (error) {
                lastError = error;
                await this.accounting.settle(envelope, elapsed(), gate, {
                    ok: false,
                    error,
                    committed: yielded,
                    tokens: prompt.length + out,
                });
                if (yielded)
                    throw error;
            }
        }
        throw lastError;
    }
    /** Resolve the active model and pass the breaker gate; fail closed. */
    open(task, modelOverride) {
        const model = this.getModel(task, modelOverride);
        if (!model) {
            throw new LMUnavailableError(`No model available for task: ${task}`, this.provider, task);
        }
        return { model, gate: this.accounting.gate(task, this.provider) };
    }
    /** One-shot re-probe of the active provider after transport failures. */
    async reprobe() {
        if (this.reprobeDone)
            return;
        this.reprobeDone = true;
        try {
            const active = await resolveActiveProvider();
            if (active !== this.provider) {
                this.registry = createSeNARSRegistry({ ...getLMSettings(), provider: active });
            }
        }
        catch {
            /* keep current registry */
        }
    }
}
export function createLMService(options) {
    return new LMService(createSeNARSRegistry(), undefined, options?.providerRuntime);
}
