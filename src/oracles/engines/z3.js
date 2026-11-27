/**
 * Z3 Oracle — SMT solving through the oracle seam.
 */
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { SenarsError } from '../../errors/senars-error';
/** Z3 Oracle implementation. */
export class Z3Oracle {
    operation = 'engine.z3';
    provider = 'z3';
    version;
    z3Path;
    defaultTimeoutMs;
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
        this.z3Path = config.z3Path ?? 'z3';
        this.defaultTimeoutMs = config.defaultTimeoutMs ?? 30000;
        this.defaultFormat = config.defaultFormat ?? 'smtlib2';
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
        const [script, options] = input.args;
        const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
        const format = options?.format ?? this.defaultFormat;
        const extraArgs = options?.args ?? [];
        const args = [format === 'smtlib2' ? '-smt2' : '-smt', '-in', ...extraArgs];
        const startTs = Date.now();
        return new Promise((resolve, reject) => {
            const child = spawn(this.z3Path, args, { timeout: timeoutMs });
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (data) => { stdout += data.toString(); });
            child.stderr.on('data', (data) => { stderr += data.toString(); });
            child.on('error', (err) => {
                reject(new SenarsError(`Z3 spawn error: ${err.message}`, 'OPERATION_ERROR'));
            });
            child.on('close', (code) => {
                const durationMs = Date.now() - startTs;
                const result = this.parseOutput(stdout, stderr, code ?? -1, durationMs);
                resolve(result);
            });
            // Write script to stdin
            child.stdin.write(script);
            child.stdin.end();
        });
    }
    parseOutput(stdout, stderr, exitCode, durationMs) {
        const result = {
            result: 'unknown',
            stdout,
            stderr,
            exitCode,
            durationMs,
        };
        // Parse Z3 output
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === 'sat') {
                result.result = 'sat';
            }
            else if (trimmed === 'unsat') {
                result.result = 'unsat';
            }
            else if (trimmed === 'unknown') {
                result.result = 'unknown';
            }
            else if (trimmed.startsWith('(model')) {
                result.model = stdout.substring(stdout.indexOf('(model'));
            }
            else if (trimmed.startsWith('(proof')) {
                result.proof = stdout.substring(stdout.indexOf('(proof'));
            }
        }
        // Extract statistics
        const statsMatch = stdout.match(/\(:statistics (.*)\)/);
        if (statsMatch && statsMatch[1]) {
            try {
                result.stats = JSON.parse(statsMatch[1]);
            }
            catch {
                // Ignore parse errors
            }
        }
        return result;
    }
    hashInput(args) {
        const json = JSON.stringify(args, (_, v) => typeof v === 'bigint' ? v.toString() : v);
        return createHash('sha256').update(json).digest('hex').substring(0, 32);
    }
    async isAvailable() {
        try {
            const child = spawn(this.z3Path, ['-version'], { timeout: 5000 });
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
/** Create a Z3 oracle. */
export function createZ3Oracle(config = {}) {
    return new Z3Oracle({
        operation: 'engine.z3',
        provider: 'z3',
        ...config,
    });
}
