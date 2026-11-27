/**
 * MiniSat WASM Oracle — SAT solving through the oracle seam using logic-solver-plus (MiniSat WASM).
 */
import { createHash } from 'crypto';
import { SenarsError } from '../../errors/senars-error';
/** MiniSat WASM Oracle implementation. */
export class MiniSatWasmOracle {
    operation = 'engine.minisat';
    provider = 'minisat-wasm';
    version;
    budgetResource;
    defaultTimeoutMs;
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
                    value: { result: 'UNKNOWN', stdout: '', stderr: '', exitCode: -1, durationMs: 0 },
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
    parseCNF(cnf) {
        const lines = cnf.trim().split('\n');
        const clauses = [];
        let maxVar = 0;
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('c') || trimmed.startsWith('p'))
                continue;
            const literals = trimmed.split(/\s+/).map(Number).filter(n => n !== 0);
            if (literals.length > 0) {
                clauses.push(literals);
                for (const lit of literals) {
                    maxVar = Math.max(maxVar, Math.abs(lit));
                }
            }
        }
        return { clauses, maxVar };
    }
    async execute(input) {
        const [cnf, options] = input.args;
        const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
        // Import logic-solver-plus dynamically
        const { Solver, or, not } = await import('logic-solver-plus');
        const startTs = Date.now();
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new SenarsError(`MiniSat WASM query timeout after ${timeoutMs}ms`, 'TIMEOUT'));
            }, timeoutMs);
            try {
                const { clauses, maxVar } = this.parseCNF(cnf);
                const solver = new Solver();
                // Add variables
                for (let i = 1; i <= maxVar; i++) {
                    solver.getVarNum(`v${i}`, false);
                }
                // Add clauses
                for (const clause of clauses) {
                    if (clause.length === 1) {
                        const lit = clause[0];
                        if (lit > 0) {
                            solver.require(`v${lit}`);
                        }
                        else {
                            solver.forbid(`v${-lit}`);
                        }
                    }
                    else {
                        const formulas = clause.map(lit => lit > 0 ? `v${lit}` : not(`v${-lit}`));
                        solver.require(or(...formulas));
                    }
                }
                const solution = solver.solve();
                const durationMs = Date.now() - startTs;
                clearTimeout(timeout);
                if (solution) {
                    const model = new Map();
                    const modelArray = [];
                    const map = solution.getMap();
                    for (let i = 1; i <= maxVar; i++) {
                        const val = map[`v${i}`] ?? false;
                        model.set(i, val);
                        modelArray.push(val ? i : -i);
                    }
                    resolve({
                        result: 'SAT',
                        model,
                        modelArray,
                        stdout: 'SAT',
                        stderr: '',
                        exitCode: 10,
                        durationMs,
                    });
                }
                else {
                    resolve({
                        result: 'UNSAT',
                        stdout: 'UNSAT',
                        stderr: '',
                        exitCode: 20,
                        durationMs,
                    });
                }
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
            const { Solver } = await import('logic-solver-plus');
            const solver = new Solver();
            await solver.initialize();
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
/** Create a MiniSat WASM oracle. */
export function createMiniSatWasmOracle(config = {}) {
    return new MiniSatWasmOracle({
        operation: 'engine.minisat',
        provider: 'minisat-wasm',
        ...config,
    });
}
