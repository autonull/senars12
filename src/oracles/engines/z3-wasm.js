/**
 * Z3 WASM Oracle — SMT solving through the oracle seam using z3-solver (WASM).
 */
import { createHash } from 'crypto';
import { SenarsError } from '../../errors/senars-error';
/** Z3 WASM Oracle implementation. */
export class Z3WasmOracle {
    operation = 'engine.z3';
    provider = 'z3-wasm';
    version;
    budgetResource;
    defaultTimeoutMs;
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
        this.defaultFormat = config.defaultFormat ?? 'smtlib2';
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
                    value: { result: 'unknown', stdout: '', stderr: '', exitCode: -1, durationMs: 0 },
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
        const [script, options] = input.args;
        const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
        const format = options?.format ?? this.defaultFormat;
        // Import z3-solver dynamically
        const { init } = await import('z3-solver');
        const { Context } = await init();
        const startTs = Date.now();
        const ctx = new Context('main');
        const solver = new ctx.Solver();
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new SenarsError(`Z3 WASM query timeout after ${timeoutMs}ms`, 'TIMEOUT'));
            }, timeoutMs);
            try {
                // Parse SMT-LIB2 script using fromString
                if (format === 'smtlib2') {
                    solver.fromString(script);
                }
                else {
                    // For SMTLIB1, we'd need different parsing
                    solver.fromString(script);
                }
                solver.check().then((result) => {
                    const durationMs = Date.now() - startTs;
                    clearTimeout(timeout);
                    const output = {
                        result,
                        stdout: '',
                        stderr: '',
                        exitCode: result === 'sat' ? 0 : result === 'unsat' ? 0 : 1,
                        durationMs,
                    };
                    if (result === 'sat') {
                        const model = solver.model();
                        output.model = model.toString();
                    }
                    else if (result === 'unsat') {
                        // Z3 doesn't provide proofs easily in the high-level API
                        output.proof = 'unsat';
                    }
                    resolve(output);
                }).catch((e) => {
                    clearTimeout(timeout);
                    reject(e);
                });
            }
            catch (e) {
                clearTimeout(timeout);
                reject(e);
            }
        });
    }
    hashInput(args) {
        const json = JSON.stringify(args, (_, v) => typeof v === 'bigint' ? v.toString() : v);
        return createHash('sha256').update(json).digest('hex').substring(0, 32);
    }
    async isAvailable() {
        try {
            const { init } = await import('z3-solver');
            await init();
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
/** Create a Z3 WASM oracle. */
export function createZ3WasmOracle(config = {}) {
    return new Z3WasmOracle({
        operation: 'engine.z3',
        provider: 'z3-wasm',
        ...config,
    });
}
