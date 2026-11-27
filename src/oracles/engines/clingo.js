/**
 * Clingo Oracle — ASP solving through the oracle seam.
 */
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { SenarsError } from '../../errors/senars-error';
/** Clingo Oracle implementation. */
export class ClingoOracle {
    operation = 'engine.clingo';
    provider = 'clingo';
    version;
    clingoPath;
    defaultTimeoutMs;
    defaultModels;
    defaultFormat;
    pinStore = null;
    isReplay = false;
    stats = {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        pinnedCalls: 0,
        totalDurationMs: 0,
    };
    constructor(config) {
        this.version = config.version;
        this.clingoPath = config.clingoPath ?? 'clingo';
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
    async call(input) {
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
        const args = [
            '--outf=' + format,
            models > 0 ? `-n ${models}` : '-n 0',
            ...extraArgs,
        ];
        const startTs = Date.now();
        return new Promise((resolve, reject) => {
            const child = spawn(this.clingoPath, args, { timeout: timeoutMs });
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (data) => { stdout += data.toString(); });
            child.stderr.on('data', (data) => { stderr += data.toString(); });
            child.on('error', (err) => {
                reject(new SenarsError(`Clingo spawn error: ${err.message}`, 'OPERATION_ERROR'));
            });
            child.on('close', (code) => {
                const durationMs = Date.now() - startTs;
                const result = this.parseOutput(stdout, stderr, code ?? -1, durationMs, format);
                resolve(result);
            });
            child.stdin.write(program);
            child.stdin.end();
        });
    }
    parseOutput(stdout, stderr, exitCode, durationMs, format) {
        const result = {
            result: 'UNKNOWN',
            models: [],
            stdout,
            stderr,
            exitCode,
            durationMs,
        };
        if (format === 'json') {
            try {
                const parsed = JSON.parse(stdout);
                if (parsed.Result) {
                    result.result = parsed.Result;
                }
                if (parsed.Models) {
                    result.models = parsed.Models.map((m, i) => ({
                        number: i + 1,
                        atoms: m.Value?.map((v) => v.toString()) ?? [],
                        optimization: m.Costs,
                        cost: m.Costs,
                    }));
                }
                if (parsed.Statistics) {
                    result.stats = parsed.Statistics;
                }
            }
            catch {
                // Fall back to text parsing
                return this.parseTextOutput(stdout, stderr, exitCode, durationMs);
            }
        }
        else {
            return this.parseTextOutput(stdout, stderr, exitCode, durationMs);
        }
        return result;
    }
    parseTextOutput(stdout, stderr, exitCode, durationMs) {
        const result = {
            result: 'UNKNOWN',
            models: [],
            stdout,
            stderr,
            exitCode,
            durationMs,
        };
        const lines = stdout.trim().split('\n');
        let currentModel = null;
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('SATISFIABLE')) {
                result.result = 'SAT';
            }
            else if (trimmed.startsWith('UNSATISFIABLE')) {
                result.result = 'UNSAT';
            }
            else if (trimmed.startsWith('UNKNOWN')) {
                result.result = 'UNKNOWN';
            }
            else if (trimmed.startsWith('Answer:')) {
                if (currentModel) {
                    result.models.push(currentModel);
                }
                const atoms = trimmed.substring(7).trim().split(' ').filter(a => a);
                currentModel = {
                    number: result.models.length + 1,
                    atoms,
                };
            }
            else if (trimmed.startsWith('Optimization:')) {
                if (currentModel) {
                    currentModel.optimization = trimmed.substring(13).trim().split(' ').map(Number).filter(n => !isNaN(n));
                }
            }
        }
        if (currentModel) {
            result.models.push(currentModel);
        }
        return result;
    }
    hashInput(args) {
        const json = JSON.stringify(args, (_, v) => typeof v === 'bigint' ? v.toString() : v);
        return createHash('sha256').update(json).digest('hex').substring(0, 32);
    }
    async isAvailable() {
        try {
            const child = spawn(this.clingoPath, ['--version'], { timeout: 5000 });
            return new Promise((resolve) => {
                child.on('close', (code) => resolve(code === 0));
                child.on('error', () => resolve(false));
            });
        }
        catch {
            return false;
        }
    }
    getStats() {
        return { ...this.stats };
    }
}
/** Create a Clingo oracle. */
export function createClingoOracle(config = {}) {
    return new ClingoOracle({
        operation: 'engine.clingo',
        provider: 'clingo',
        ...config,
    });
}
