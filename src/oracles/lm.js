/**
 * LM Oracle — wraps LM service calls through the oracle seam.
 *
 * This is the bridge between the existing nar/src/lm/service/LMService
 * and the new oracle framework.
 */
import { createHash } from 'crypto';
import { generateText, generateObject, streamText } from 'ai';
import { zodSchema } from 'ai';
import { SenarsError } from '../errors/senars-error';
/** LM Oracle implementation. */
export class LMOracle {
    operation;
    provider;
    version;
    budgetResource;
    lmService;
    defaultTask;
    maxOutputTokens;
    temperature;
    pinStore = null;
    isReplay = false;
    defaultBudgetSlice;
    stats = {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        pinnedCalls: 0,
        totalDurationMs: 0,
        totalTokens: 0,
    };
    constructor(config) {
        this.operation = config.operation;
        this.provider = config.provider;
        this.version = config.version;
        this.budgetResource = config.budgetResource;
        this.defaultBudgetSlice = config.budgetSlice;
        this.lmService = config.lmService;
        this.defaultTask = config.defaultTask ?? 'fast';
        this.maxOutputTokens = config.maxOutputTokens;
        this.temperature = config.temperature;
    }
    /** Set the pin store for deterministic replay. */
    setPinStore(store) {
        this.pinStore = store;
    }
    /** Enable/disable replay mode. */
    setReplayMode(replay) {
        this.isReplay = replay;
    }
    async call(input, budgetSlice) {
        // Charge budget if configured
        const effectiveBudgetSlice = budgetSlice ?? this.defaultBudgetSlice;
        if (effectiveBudgetSlice && this.budgetResource) {
            const { consume } = await import('../budget/budget');
            const charged = consume(effectiveBudgetSlice, this.budgetResource, 1);
            if (!charged) {
                const callId = crypto.randomUUID();
                const startTs = Date.now();
                this.stats.totalCalls++;
                this.stats.failedCalls++;
                const error = `Budget exhausted for ${this.budgetResource}`;
                return {
                    value: '',
                    meta: {
                        callId,
                        ts: startTs,
                        durationMs: 0,
                        provider: this.provider,
                        version: this.version,
                        pinned: false,
                        error,
                    },
                };
            }
        }
        const callId = crypto.randomUUID();
        const startTs = Date.now();
        let pinned = false;
        let error;
        let value;
        this.stats.totalCalls++;
        try {
            // Check pin store first if in replay mode
            if (this.isReplay && this.pinStore) {
                const pinnedValue = await this.pinStore.getPin(this.operation, input.args, this.provider, this.version, input.context);
                if (pinnedValue !== null) {
                    this.stats.pinnedCalls++;
                    this.stats.successfulCalls++;
                    return {
                        value: pinnedValue,
                        meta: {
                            callId,
                            ts: startTs,
                            durationMs: 0,
                            provider: this.provider,
                            version: this.version,
                            pinned: true,
                        },
                    };
                }
            }
            value = await this.execute(input);
            this.stats.successfulCalls++;
            // Pin the result if not in replay mode
            if (!this.isReplay && this.pinStore) {
                await this.pinStore.pin(this.operation, this.hashInput(input.args), this.provider, this.version, input.context, value);
            }
        }
        catch (e) {
            this.stats.failedCalls++;
            error = e instanceof Error ? e.message : String(e);
            throw e;
        }
        finally {
            const durationMs = Date.now() - startTs;
            this.stats.totalDurationMs += durationMs;
        }
        return {
            value,
            meta: {
                callId,
                ts: startTs,
                durationMs: Date.now() - startTs,
                provider: this.provider,
                version: this.version,
                pinned,
                error,
                tokens: this.extractTokens(value),
            },
        };
    }
    async execute(input) {
        const [prompt, options] = input.args;
        switch (this.operation) {
            case 'lm.generateText': {
                const opts = options;
                const task = opts?.task ?? this.defaultTask;
                const model = this.lmService.getModel(task, opts?.model);
                if (!model) {
                    throw new SenarsError(`No model available for task: ${task}`, 'OPERATION_ERROR');
                }
                const { text, usage } = await generateText({
                    model,
                    prompt,
                    abortSignal: opts?.signal,
                    temperature: opts?.temperature ?? this.temperature,
                    maxOutputTokens: opts?.maxOutputTokens ?? this.maxOutputTokens,
                });
                if (usage && typeof usage.totalTokens === 'number') {
                    this.stats.totalTokens += usage.totalTokens;
                }
                return text;
            }
            case 'lm.generateObject': {
                const [_prompt, schema, opts] = input.args;
                const task = opts?.task ?? 'structured';
                const model = this.lmService.getModel(task, opts?.model);
                if (!model) {
                    throw new SenarsError(`No model available for task: ${task}`, 'OPERATION_ERROR');
                }
                const { object, usage } = await generateObject({
                    model,
                    prompt,
                    schema: zodSchema(schema),
                    temperature: opts?.temperature,
                    abortSignal: opts?.signal,
                });
                if (usage && typeof usage.totalTokens === 'number') {
                    this.stats.totalTokens += usage.totalTokens;
                }
                return object;
            }
            case 'lm.stream': {
                const [_prompt, opts] = input.args;
                const task = opts?.task ?? this.defaultTask;
                const model = this.lmService.getModel(task);
                if (!model) {
                    throw new SenarsError(`No model available for task: ${task}`, 'OPERATION_ERROR');
                }
                const result = streamText({ model, prompt, abortSignal: opts?.signal });
                return result.textStream;
            }
            default:
                throw new SenarsError(`Unknown LM operation: ${this.operation}`, 'VALIDATION_ERROR');
        }
    }
    hashInput(args) {
        const json = JSON.stringify(args, (_, v) => typeof v === 'bigint' ? v.toString() : v);
        return createHash('sha256').update(json).digest('hex').substring(0, 32);
    }
    extractTokens(value) {
        // Token extraction would require access to usage from the AI SDK
        // This is a placeholder - actual implementation would track usage
        return undefined;
    }
    async isAvailable() {
        return this.lmService.hasModel();
    }
    getStats() {
        return { ...this.stats };
    }
}
/** Create an LM oracle for generateText. */
export function createLMGenerateTextOracle(lmService, config = {}) {
    return new LMOracle({
        operation: 'lm.generateText',
        provider: lmService.provider ?? 'unknown',
        version: lmService.model,
        lmService,
        ...config,
    });
}
/** Create an LM oracle for generateObject. */
export function createLMGenerateObjectOracle(lmService, config = {}) {
    return new LMOracle({
        operation: 'lm.generateObject',
        provider: lmService.provider ?? 'unknown',
        version: lmService.model,
        lmService,
        ...config,
    });
}
/** Create an LM oracle for stream. */
export function createLMStreamOracle(lmService, config = {}) {
    return new LMOracle({
        operation: 'lm.stream',
        provider: lmService.provider ?? 'unknown',
        version: lmService.model,
        lmService,
        ...config,
    });
}
/** Register all LM oracles with the registry. */
export function registerLMOracles(lmService, pinStore) {
    const oracles = [
        createLMGenerateTextOracle(lmService),
        createLMGenerateObjectOracle(lmService),
        createLMStreamOracle(lmService),
    ];
    if (pinStore) {
        for (const oracle of oracles) {
            oracle.setPinStore(pinStore);
        }
    }
    // Register with global registry
    const { oracleRegistry } = require('./oracle');
    for (const oracle of oracles) {
        oracleRegistry.register(oracle);
    }
    return oracles;
}
