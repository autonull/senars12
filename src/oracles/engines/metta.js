/**
 * MeTTa Oracle — MeTTa evaluation/rewriting through the oracle seam.
 */
import { createHash } from 'crypto';
import { parseMeTTa } from '../../metta/parser/runtime';
import { createMeTTa } from '../../metta/runtime/builder';
/** MeTTa Oracle implementation. */
export class MettaOracle {
    operation = 'engine.metta';
    provider = 'metta';
    version;
    budgetResource;
    runtime;
    defaultTimeoutMs;
    defaultMaxSteps;
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
        this.defaultMaxSteps = config.defaultMaxSteps ?? 1000;
        this.runtime = createMeTTa();
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
                    value: { success: false, results: [], error, durationMs: 0 },
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
    atomToJson(atom) {
        switch (atom.kind) {
            case 0: // SymbolAtom
                return { kind: 'symbol', value: atom.value };
            case 1: // VariableAtom
                return { kind: 'variable', name: atom.name };
            case 2: // NumberAtom
                return { kind: 'number', value: atom.value };
            case 3: // ExpressionAtom
                return {
                    kind: 'expression',
                    operator: this.atomToJson(atom.operator),
                    args: atom.args.map((a) => this.atomToJson(a)),
                };
            case 4: // GroundedAtom
                return { kind: 'grounded', type: atom.type, value: atom.value };
            default:
                return { kind: 'symbol', value: String(atom) };
        }
    }
    async execute(input) {
        const [expression, options] = input.args;
        const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
        const maxSteps = options?.maxSteps ?? this.defaultMaxSteps;
        const memoryLimit = options?.memoryLimit;
        const startTs = Date.now();
        try {
            const program = parseMeTTa(expression);
            const { Effect } = await import('effect');
            const result = await Effect.runPromise(this.runtime.evaluate(program, {
                maxSteps,
                timeout: timeoutMs,
                memoryLimit,
            }));
            const durationMs = Date.now() - startTs;
            return {
                success: true,
                results: [this.atomToJson(result)],
                durationMs,
            };
        }
        catch (e) {
            const durationMs = Date.now() - startTs;
            const error = e instanceof Error ? e.message : String(e);
            return {
                success: false,
                results: [],
                error,
                durationMs,
            };
        }
    }
    hashInput(args) {
        const json = JSON.stringify(args, (_, v) => typeof v === 'bigint' ? v.toString() : v);
        return createHash('sha256').update(json).digest('hex').substring(0, 32);
    }
    async isAvailable() {
        try {
            const testRuntime = createMeTTa();
            const { Effect } = await import('effect');
            const { parseMeTTa } = await import('../../metta/parser/runtime');
            await Effect.runPromise(testRuntime.evaluate(parseMeTTa('(= 1 1)')));
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
/** Create a MeTTa oracle. */
export function createMettaOracle(config = {}) {
    return new MettaOracle({
        operation: 'engine.metta',
        provider: 'metta',
        ...config,
    });
}
