/**
 * Clingo WASM Oracle — ASP solving through the oracle seam using clingo-wasm.
 */
import { createHash } from 'crypto';
import { SenarsError } from '../../errors/senars-error';
/** Clingo WASM Oracle implementation. */
export class ClingoWasmOracle {
    operation = 'engine.clingo';
    provider = 'clingo-wasm';
    version;
    budgetResource;
    defaultTimeoutMs;
    defaultModels;
    defaultFormat;
    pinStore = null;
    isReplay = false;
    defaultBudgetSlice;
    stats = {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        pinnedCalls: 0,
        totalDurationMs: 0,
    };
    constructor(config) {
        this.version = config.version;
        this.budgetResource = config.budgetResource;
        this.defaultBudgetSlice = config.budgetSlice;
        this.defaultTimeoutMs = config.defaultTimeoutMs ?? 30000;
        this.defaultModels = config.defaultModels ?? 0;
        this.defaultFormat = config.defaultFormat ?? 'json';
    }
    setPinStore(store) {
        this.pinStore = store;
    }
    setReplayMode(replay) {
        this.isReplay = replay;
    }
    async call(input, budgetSlice) {
        // Charge budget if configured
        const effectiveBudgetSlice = budgetSlice ?? this.defaultBudgetSlice;
        if (effectiveBudgetSlice && this.budgetResource) {
            const { consume } = await import('../../budget/budget');
            const charged = consume(effectiveBudgetSlice, this.budgetResource, 1);
            if (!charged) {
                const callId = crypto.randomUUID();
                const startTs = Date.now();
                this.stats.totalCalls++;
                this.stats.failedCalls++;
                const error = `Budget exhausted for ${this.budgetResource}`;
                return {
                    value: { result: 'UNKNOWN', models: [], stdout: '', stderr: '', exitCode: -1, durationMs: 0 },
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
            },
        };
    }
    async execute(input) {
        const [program, options] = input.args;
        const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
        const models = options?.models ?? this.defaultModels;
        const format = options?.format ?? this.defaultFormat;
        const extraArgs = options?.args ?? [];
        // Import clingo-wasm dynamically
        const clingo = await import('clingo-wasm');
        await clingo.init();
        const startTs = Date.now();
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new SenarsError(`Clingo WASM query timeout after ${timeoutMs}ms`, 'TIMEOUT'));
            }, timeoutMs);
            clingo.run(program, models, extraArgs)
                .then((result) => {
                clearTimeout(timeout);
                const durationMs = Date.now() - startTs;
                let output;
                if (result && result.Result) {
                    output = {
                        result: result.Result,
                        models: (result.Models || []).map((m, i) => ({
                            number: i + 1,
                            atoms: m.Value?.map((v) => v.toString()) ?? [],
                            optimization: m.Costs,
                            cost: m.Costs,
                        })),
                        stats: result.Statistics,
                        stdout: JSON.stringify(result),
                        stderr: '',
                        exitCode: result.Result === 'SATISFIABLE' ? 0 : result.Result === 'UNSATISFIABLE' ? 0 : 1,
                        durationMs,
                    };
                }
                else {
                    output = {
                        result: 'UNKNOWN',
                        models: [],
                        stdout: '',
                        stderr: result?.Error || 'Unknown error',
                        exitCode: 1,
                        durationMs,
                    };
                }
                resolve(output);
            })
                .catch((err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }
    hashInput(args) {
        const json = JSON.stringify(args, (_, v) => typeof v === 'bigint' ? v.toString() : v);
        return createHash('sha256').update(json).digest('hex').substring(0, 32);
    }
    async isAvailable() {
        try {
            const clingo = await import('clingo-wasm');
            await clingo.init();
            return true;
        }
        catch {
            return false;
        }
    }
    getStats() {
        return { ...this.stats };
    }
}
/** Create a Clingo WASM oracle. */
export function createClingoWasmOracle(config = {}) {
    return new ClingoWasmOracle({
        operation: 'engine.clingo',
        provider: 'clingo-wasm',
        ...config,
    });
}
