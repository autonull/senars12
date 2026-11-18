/**
 * MiniSat Oracle — SAT solving through the oracle seam.
 */

import { spawn } from 'child_process';
import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import type { Oracle, OracleInput, OracleOutput, OracleConfig, OracleOperation } from '../oracle.js';
import { OraclePinStore } from '../pins.js';

/** Input for MiniSat SAT solving. */
export interface MiniSatInput extends OracleInput {
  operation: 'engine.minisat';
  args: [cnf: string, options?: MiniSatOptions];
}

/** MiniSat execution options. */
export interface MiniSatOptions {
  /** Timeout in milliseconds. */
  timeoutMs?: number;
  /** Additional command-line arguments. */
  args?: string[];
}

/** MiniSat execution result. */
export interface MiniSatResult {
  /** Solver result: 'SAT', 'UNSAT', 'UNKNOWN'. */
  result: 'SAT' | 'UNSAT' | 'UNKNOWN';
  /** Model (if SAT) - variable assignments. */
  model?: Map<number, boolean>;
  /** Model as array (for JSON serialization). */
  modelArray?: number[];
  /** Raw stdout. */
  stdout: string;
  /** Raw stderr. */
  stderr: string;
  /** Exit code. */
  exitCode: number;
  /** Duration in ms. */
  durationMs: number;
}

/** MiniSat Oracle configuration. */
export interface MiniSatOracleConfig extends OracleConfig {
  operation: 'engine.minisat';
  /** Path to MiniSat executable. */
  minisatPath?: string;
  /** Default timeout. */
  defaultTimeoutMs?: number;
}

/** MiniSat Oracle implementation. */
export class MiniSatOracle implements Oracle<MiniSatInput, MiniSatResult> {
  public readonly operation: 'engine.minisat' = 'engine.minisat';
  public readonly provider: string = 'minisat';
  public readonly version?: string;

  private minisatPath: string;
  private defaultTimeoutMs: number;
  private pinStore: OraclePinStore | null = null;
  private isReplay = false;

  private stats = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    pinnedCalls: 0,
    totalDurationMs: 0,
  };

  constructor(config: MiniSatOracleConfig) {
    this.version = config.version;
    this.minisatPath = config.minisatPath ?? 'minisat';
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 30000;
  }

  setPinStore(store: OraclePinStore): void {
    this.pinStore = store;
  }

  setReplayMode(replay: boolean): void {
    this.isReplay = replay;
  }

  async call(input: MiniSatInput): Promise<OracleOutput<MiniSatResult>> {
    const callId = crypto.randomUUID();
    const startTs = Date.now();
    let pinned = false;
    let error: string | undefined;
    let value: MiniSatResult;

    this.stats.totalCalls++;

    try {
      if (this.isReplay && this.pinStore) {
        const pinnedValue = await this.pinStore.getPin(this.operation, input.args);
        if (pinnedValue !== null) {
          this.stats.pinnedCalls++;
          this.stats.successfulCalls++;
          return {
            value: pinnedValue as MiniSatResult,
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
        await this.pinStore.pin(this.operation, this.hashInput(input.args), value);
      }
    } catch (e) {
      this.stats.failedCalls++;
      error = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
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

  private async execute(input: MiniSatInput): Promise<MiniSatResult> {
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
          reject(new Error(`MiniSat spawn error: ${err.message}`));
        });

        child.on('close', async (code) => {
          const durationMs = Date.now() - startTs;
          try {
            const result = await this.parseOutput(cnfFile, outFile, stdout, stderr, code ?? -1, durationMs);
            resolve(result);
          } catch (e) {
            reject(e);
          } finally {
            // Cleanup temp files
            try {
              await fs.unlink(cnfFile);
              await fs.unlink(outFile);
            } catch {
              // Ignore cleanup errors
            }
          }
        });
      });
    } catch (e) {
      // Cleanup on error
      try {
        await fs.unlink(cnfFile);
      } catch {}
      throw e;
    }
  }

  private async parseOutput(cnfFile: string, outFile: string, stdout: string, stderr: string, exitCode: number, durationMs: number): Promise<MiniSatResult> {
    const result: MiniSatResult = {
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
      } catch {
        // Model parsing failed
      }
    } else if (exitCode === 20) {
      result.result = 'UNSAT';
    } else {
      result.result = 'UNKNOWN';
    }

    return result;
  }

  private parseModel(content: string): Map<number, boolean> {
    const model = new Map<number, boolean>();
    const lines = content.trim().split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('v ')) {
        const literals = trimmed.substring(2).trim().split(/\s+/).map(Number);
        for (const lit of literals) {
          if (lit === 0) continue; // End of model marker
          const var_ = Math.abs(lit);
          const val = lit > 0;
          model.set(var_, val);
        }
      }
    }
    return model;
  }

  private hashInput(args: unknown[]): string {
    const json = JSON.stringify(args, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v
    );
    return createHash('sha256').update(json).digest('hex').substring(0, 32);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const child = spawn(this.minisatPath, [], { timeout: 5000 });
      return new Promise((resolve) => {
        child.on('close', (code) => resolve(code === 0 || code === 1)); // MiniSat returns 1 on no args
        child.on('error', () => resolve(false));
      });
    } catch {
      return false;
    }
  }

  getStats() {
    return { ...this.stats };
  }
}

/** Create a MiniSat oracle. */
export function createMiniSatOracle(config: Partial<Omit<MiniSatOracleConfig, 'operation'>> = {}): MiniSatOracle {
  return new MiniSatOracle({
    operation: 'engine.minisat',
    provider: 'minisat',
    ...config,
  });
}