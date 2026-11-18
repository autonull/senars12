/**
 * Clingo Oracle — ASP solving through the oracle seam.
 */

import { spawn } from 'child_process';
import { createHash } from 'crypto';
import type { Oracle, OracleInput, OracleOutput, OracleConfig, OracleOperation } from '../oracle.js';
import { OraclePinStore } from '../pins.js';

/** Input for Clingo ASP solving. */
export interface ClingoInput extends OracleInput {
  operation: 'engine.clingo';
  args: [program: string, options?: ClingoOptions];
}

/** Clingo execution options. */
export interface ClingoOptions {
  /** Timeout in milliseconds. */
  timeoutMs?: number;
  /** Number of models to compute (0 = all). */
  models?: number;
  /** Additional command-line arguments. */
  args?: string[];
  /** Output format: 'json' | 'text'. */
  format?: 'json' | 'text';
}

/** Clingo execution result. */
export interface ClingoResult {
  /** Solver result: 'SAT', 'UNSAT', 'UNKNOWN'. */
  result: 'SAT' | 'UNSAT' | 'UNKNOWN';
  /** Models found. */
  models: ClingoModel[];
  /** Statistics. */
  stats?: Record<string, unknown>;
  /** Raw stdout. */
  stdout: string;
  /** Raw stderr. */
  stderr: string;
  /** Exit code. */
  exitCode: number;
  /** Duration in ms. */
  durationMs: number;
}

/** Clingo model. */
export interface ClingoModel {
  /** Model number. */
  number: number;
  /** Atoms in the model. */
  atoms: string[];
  /** Optimization value (if any). */
  optimization?: number[];
  /** Cost (if any). */
  cost?: number[];
}

/** Clingo Oracle configuration. */
export interface ClingoOracleConfig extends OracleConfig {
  operation: 'engine.clingo';
  /** Path to Clingo executable. */
  clingoPath?: string;
  /** Default timeout. */
  defaultTimeoutMs?: number;
  /** Default number of models. */
  defaultModels?: number;
  /** Default output format. */
  defaultFormat?: 'json' | 'text';
}

/** Clingo Oracle implementation. */
export class ClingoOracle implements Oracle<ClingoInput, ClingoResult> {
  public readonly operation: 'engine.clingo' = 'engine.clingo';
  public readonly provider: string = 'clingo';
  public readonly version?: string;

  private clingoPath: string;
  private defaultTimeoutMs: number;
  private defaultModels: number;
  private defaultFormat: 'json' | 'text';
  private pinStore: OraclePinStore | null = null;
  private isReplay = false;

  private stats = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    pinnedCalls: 0,
    totalDurationMs: 0,
  };

  constructor(config: ClingoOracleConfig) {
    this.version = config.version;
    this.clingoPath = config.clingoPath ?? 'clingo';
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 30000;
    this.defaultModels = config.defaultModels ?? 0;
    this.defaultFormat = config.defaultFormat ?? 'json';
  }

  setPinStore(store: OraclePinStore): void {
    this.pinStore = store;
  }

  setReplayMode(replay: boolean): void {
    this.isReplay = replay;
  }

  async call(input: ClingoInput): Promise<OracleOutput<ClingoResult>> {
    const callId = crypto.randomUUID();
    const startTs = Date.now();
    let pinned = false;
    let error: string | undefined;
    let value: ClingoResult;

    this.stats.totalCalls++;

    try {
      if (this.isReplay && this.pinStore) {
        const pinnedValue = await this.pinStore.getPin(this.operation, input.args);
        if (pinnedValue !== null) {
          this.stats.pinnedCalls++;
          this.stats.successfulCalls++;
          return {
            value: pinnedValue as ClingoResult,
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

  private async execute(input: ClingoInput): Promise<ClingoResult> {
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
        reject(new Error(`Clingo spawn error: ${err.message}`));
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

  private parseOutput(stdout: string, stderr: string, exitCode: number, durationMs: number, format: 'json' | 'text'): ClingoResult {
    const result: ClingoResult = {
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
          result.models = parsed.Models.map((m: any, i: number) => ({
            number: i + 1,
            atoms: m.Value?.map((v: any) => v.toString()) ?? [],
            optimization: m.Costs,
            cost: m.Costs,
          }));
        }
        if (parsed.Statistics) {
          result.stats = parsed.Statistics;
        }
      } catch {
        // Fall back to text parsing
        return this.parseTextOutput(stdout, stderr, exitCode, durationMs);
      }
    } else {
      return this.parseTextOutput(stdout, stderr, exitCode, durationMs);
    }

    return result;
  }

  private parseTextOutput(stdout: string, stderr: string, exitCode: number, durationMs: number): ClingoResult {
    const result: ClingoResult = {
      result: 'UNKNOWN',
      models: [],
      stdout,
      stderr,
      exitCode,
      durationMs,
    };

    const lines = stdout.trim().split('\n');
    let currentModel: ClingoModel | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('SATISFIABLE')) {
        result.result = 'SAT';
      } else if (trimmed.startsWith('UNSATISFIABLE')) {
        result.result = 'UNSAT';
      } else if (trimmed.startsWith('UNKNOWN')) {
        result.result = 'UNKNOWN';
      } else if (trimmed.startsWith('Answer:')) {
        if (currentModel) {
          result.models.push(currentModel);
        }
        const atoms = trimmed.substring(7).trim().split(' ').filter(a => a);
        currentModel = {
          number: result.models.length + 1,
          atoms,
        };
      } else if (trimmed.startsWith('Optimization:')) {
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

  private hashInput(args: unknown[]): string {
    const json = JSON.stringify(args, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v
    );
    return createHash('sha256').update(json).digest('hex').substring(0, 32);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const child = spawn(this.clingoPath, ['--version'], { timeout: 5000 });
      return new Promise((resolve) => {
        child.on('close', (code) => resolve(code === 0));
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

/** Create a Clingo oracle. */
export function createClingoOracle(config: Partial<Omit<ClingoOracleConfig, 'operation'>> = {}): ClingoOracle {
  return new ClingoOracle({
    operation: 'engine.clingo',
    provider: 'clingo',
    ...config,
  });
}