/**
 * MiniSat Oracle — SAT solving through the oracle seam.
 */
import { spawn } from 'child_process';
import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { SenarsError } from '../../errors/senars-error';
/** MiniSat Oracle implementation. */
export class MiniSatOracle {
    operation = 'engine.minisat';
    provider = 'minisat';
    version;
    minisatPath;
    defaultTimeoutMs;
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
        this.minisatPath = config.minisatPath ?? 'minisat';
        this.defaultTimeoutMs = config.defaultTimeoutMs ?? 30000;
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
        const [cnf, options] = input.args;
        const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
        const extraArgs = options?.args ?? [];
        // Write CNF to a temporary file
        const tempDir = join(process.cwd(), 'tmp');
        await fs.mkdir(tempDir, { recursive: true });
        const cnfFile = join(tempDir, `minisat-${randomUUID()}.cnf`);
        const outFile = join(tempDir, `minisat-${randomUUID()}.out`);
        try {
            await fs.writeFile(cnfFile, cnf);
            const args = [cnfFile, outFile, ...extraArgs];
            const startTs = Date.now();
            return await new Promise((resolve, reject) => {
                const child = spawn(this.minisatPath, args, { timeout: timeoutMs });
                let stdout = '';
                let stderr = '';
                child.stdout.on('data', (data) => { stdout += data.toString(); });
                child.stderr.on('data', (data) => { stderr += data.toString(); });
                child.on('error', (err) => {
                    reject(new SenarsError(`MiniSat spawn error: ${err.message}`, 'OPERATION_ERROR'));
                });
                child.on('close', async (code) => {
                    const durationMs = Date.now() - startTs;
                    try {
                        const result = await this.parseOutput(cnfFile, outFile, stdout, stderr, code ?? -1, durationMs);
                        resolve(result);
                    }
                    catch (e) {
                        reject(e);
                    }
                    finally {
                        // Cleanup temp files
                        try {
                            await fs.unlink(cnfFile);
                            await fs.unlink(outFile);
                        }
                        catch {
                            // Ignore cleanup errors
                        }
                    }
                });
            });
        }
        catch (e) {
            // Cleanup on error
            try {
                await fs.unlink(cnfFile);
            }
            catch { }
            throw e;
        }
    }
    async parseOutput(cnfFile, outFile, stdout, stderr, exitCode, durationMs) {
        const result = {
            result: 'UNKNOWN',
            stdout,
            stderr,
            exitCode,
            durationMs,
        };
        // MiniSat exit codes: 10 = SAT, 20 = UNSAT, 0 = UNKNOWN/ERROR
        if (exitCode === 10) {
            result.result = 'SAT';
            try {
                const outContent = await fs.readFile(outFile, 'utf-8');
                const model = this.parseModel(outContent);
                result.model = model;
                result.modelArray = Array.from(model.entries()).map(([var_, val]) => val ? var_ : -var_);
            }
            catch {
                // Model parsing failed
            }
        }
        else if (exitCode === 20) {
            result.result = 'UNSAT';
        }
        else {
            result.result = 'UNKNOWN';
        }
        return result;
    }
    parseModel(content) {
        const model = new Map();
        const lines = content.trim().split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('v ')) {
                const literals = trimmed.substring(2).trim().split(/\s+/).map(Number);
                for (const lit of literals) {
                    if (lit === 0)
                        continue; // End of model marker
                    const var_ = Math.abs(lit);
                    const val = lit > 0;
                    model.set(var_, val);
                }
            }
        }
        return model;
    }
    hashInput(args) {
        const json = JSON.stringify(args, (_, v) => typeof v === 'bigint' ? v.toString() : v);
        return createHash('sha256').update(json).digest('hex').substring(0, 32);
    }
    async isAvailable() {
        try {
            const child = spawn(this.minisatPath, [], { timeout: 5000 });
            return new Promise((resolve) => {
                child.on('close', (code) => resolve(code === 0 || code === 1)); // MiniSat returns 1 on no args
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
/** Create a MiniSat oracle. */
export function createMiniSatOracle(config = {}) {
    return new MiniSatOracle({
        operation: 'engine.minisat',
        provider: 'minisat',
        ...config,
    });
}
