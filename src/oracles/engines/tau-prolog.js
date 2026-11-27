/**
 * Tau Prolog Oracle — Prolog reasoning through the oracle seam.
 */
import { createHash } from 'crypto';
import { SenarsError } from '../../errors/senars-error';
/** Tau Prolog Oracle implementation. */
export class TauPrologOracle {
    operation = 'engine.tau-prolog';
    provider = 'tau-prolog';
    version;
    budgetResource;
    defaultTimeoutMs;
    defaultMaxSolutions;
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
        this.defaultMaxSolutions = config.defaultMaxSolutions ?? 100;
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
                    value: { success: false, solutions: [], error, durationMs: 0 },
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
        const [program, query, options] = input.args;
        const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
        const maxSolutions = options?.maxSolutions ?? this.defaultMaxSolutions;
        const includeStats = options?.stats ?? false;
        // Dynamically import tau-prolog to avoid requiring it as a dependency
        let pl;
        try {
            pl = await import('tau-prolog');
        }
        catch {
            throw new SenarsError('tau-prolog not installed. Install with: pnpm add tau-prolog', 'OPERATION_ERROR', { suggestion: 'pnpm add tau-prolog' });
        }
        const startTs = Date.now();
        const session = pl.create(1000); // 1000ms limit per query
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new SenarsError(`Tau Prolog query timeout after ${timeoutMs}ms`, 'TIMEOUT', { timeoutMs, elapsedMs: Date.now() - startTs }));
            }, timeoutMs);
            session.consult(program, {
                success: () => {
                    session.query(query, {
                        success: (goal) => {
                            const solution = {
                                bindings: {},
                                number: this.stats.successfulCalls + 1,
                            };
                            // Extract variable bindings
                            for (const [key, value] of goal.substitution.links) {
                                solution.bindings[key.id] = this.termToJS(value);
                            }
                            // Check if we have enough solutions
                            if (this.stats.successfulCalls >= maxSolutions) {
                                clearTimeout(timeout);
                                resolve({
                                    success: true,
                                    solutions: [solution],
                                    durationMs: Date.now() - startTs,
                                });
                                return;
                            }
                            // Continue for more solutions
                            session.answer(goal, {
                                success: (nextGoal) => {
                                    const nextSolution = {
                                        bindings: {},
                                        number: this.stats.successfulCalls + 2,
                                    };
                                    for (const [key, value] of nextGoal.substitution.links) {
                                        nextSolution.bindings[key.id] = this.termToJS(value);
                                    }
                                    // This is simplified - in practice you'd loop
                                },
                                error: (err) => {
                                    clearTimeout(timeout);
                                    resolve({
                                        success: true,
                                        solutions: [solution],
                                        durationMs: Date.now() - startTs,
                                    });
                                },
                                fail: () => {
                                    clearTimeout(timeout);
                                    resolve({
                                        success: true,
                                        solutions: [solution],
                                        durationMs: Date.now() - startTs,
                                    });
                                },
                                limit: () => {
                                    clearTimeout(timeout);
                                    resolve({
                                        success: true,
                                        solutions: [solution],
                                        durationMs: Date.now() - startTs,
                                    });
                                },
                            });
                        },
                        error: (err) => {
                            clearTimeout(timeout);
                            resolve({
                                success: false,
                                solutions: [],
                                error: err?.message ?? String(err),
                                durationMs: Date.now() - startTs,
                            });
                        },
                        fail: () => {
                            clearTimeout(timeout);
                            resolve({
                                success: false,
                                solutions: [],
                                error: 'Query failed',
                                durationMs: Date.now() - startTs,
                            });
                        },
                        limit: () => {
                            clearTimeout(timeout);
                            resolve({
                                success: false,
                                solutions: [],
                                error: 'Query limit exceeded',
                                durationMs: Date.now() - startTs,
                            });
                        },
                    });
                },
                error: (err) => {
                    clearTimeout(timeout);
                    resolve({
                        success: false,
                        solutions: [],
                        error: err?.message ?? String(err),
                        durationMs: Date.now() - startTs,
                    });
                },
            });
        });
    }
    termToJS(term) {
        if (term instanceof term.constructor.Term) {
            if (term.constructor.name === 'Var') {
                return { type: 'var', name: term.id };
            }
            else if (term.constructor.name === 'Num') {
                return term.value;
            }
            else if (term.constructor.name === 'Term') {
                return {
                    type: 'compound',
                    name: term.id,
                    args: term.args.map((arg) => this.termToJS(arg)),
                };
            }
        }
        return term;
    }
    hashInput(args) {
        const json = JSON.stringify(args, (_, v) => typeof v === 'bigint' ? v.toString() : v);
        return createHash('sha256').update(json).digest('hex').substring(0, 32);
    }
    async isAvailable() {
        try {
            await import('tau-prolog');
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
/** Create a Tau Prolog oracle. */
export function createTauPrologOracle(config = {}) {
    return new TauPrologOracle({
        operation: 'engine.tau-prolog',
        provider: 'tau-prolog',
        ...config,
    });
}
