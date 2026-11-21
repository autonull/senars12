/**
 * Clingo WASM Oracle — ASP solving through the oracle seam using clingo-wasm.
 */

import { createHash } from 'crypto';
import type { Oracle, OracleInput, OracleOutput, OracleConfig, OracleOperation } from '../oracle.js';
import { OraclePinStore } from '../pins.js';

/** Input for Clingo ASP solving. */
export interface ClingoWasmInput extends OracleInput {
  operation: 'engine.clingo';
  args: [program: string, options?: ClingoWasmOptions];
}

/** Clingo execution options. */
export interface ClingoWasmOptions {
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
export interface ClingoWasmResult {
  /** Solver result: 'SAT', 'UNSAT', 'UNKNOWN'. */
  result: 'SAT' | 'UNSAT' | 'UNKNOWN';
  /** Models found. */
  models: ClingoWasmModel[];
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
export interface ClingoWasmModel {
  /** Model number. */
  number: number;
  /** Atoms in the model. */
  atoms: string[];
  /** Optimization value (if any). */
  optimization?: number[];
  /** Cost (if any). */
  cost?: number[];
}

/** Clingo WASM Oracle configuration. */
export interface ClingoWasmOracleConfig extends OracleConfig {
  operation: 'engine.clingo';
  /** Default timeout. */
  defaultTimeoutMs?: number;
  /** Default number of models. */
  defaultModels?: number;
  /** Default output format. */
  defaultFormat?: 'json' | 'text';
}

/** Clingo WASM Oracle implementation. */
export class ClingoWasmOracle implements Oracle<ClingoWasmInput, ClingoWasmResult> {
  public readonly operation: 'engine.clingo' = 'engine.clingo';
  public readonly provider: string = 'clingo-wasm';
  public readonly version?: string;

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

  constructor(config: ClingoWasmOracleConfig) {
    this.version = config.version;
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

  async call(input: ClingoWasmInput): Promise<OracleOutput<ClingoWasmResult>> {
    const callId = crypto.randomUUID();
    const startTs = Date.now();
    let pinned = false;
    let error: string | undefined;
    let value: ClingoWasmResult;

    this.stats.totalCalls++;

    try {
      if (this.isReplay && this.pinStore) {
        const pinnedValue = await this.pinStore.getPin(this.operation, input.args);
        if (pinnedValue !== null) {
          this.stats.pinnedCalls++;
          this.stats.successfulCalls++;
          return {
            value: pinnedValue as ClingoWasmResult,
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

  private async execute(input: ClingoWasmInput): Promise<ClingoWasmResult> {
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
        reject(new Error(`Clingo WASM query timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      clingo.run(program, models, extraArgs)
        .then((result: any) => {
          clearTimeout(timeout);
          const durationMs = Date.now() - startTs;

          let output: ClingoWasmResult;

          if (result && result.Result) {
            output = {
              result: result.Result,
              models: (result.Models || []).map((m: any, i: number) => ({
                number: i + 1,
                atoms: m.Value?.map((v: any) => v.toString()) ?? [],
                optimization: m.Costs,
                cost: m.Costs,
              })),
              stats: result.Statistics,
              stdout: JSON.stringify(result),
              stderr: '',
              exitCode: result.Result === 'SATISFIABLE' ? 0 : result.Result === 'UNSATISFIABLE' ? 0 : 1,
              durationMs,
            };
          } else {
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
        .catch((err: any) => {
          clearTimeout(timeout);
          reject(err);
        });
    });
  }

  private hashInput(args: unknown[]): string {
    const json = JSON.stringify(args, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v
    );
    return createHash('sha256').update(json).digest('hex').substring(0, 32);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const clingo = await import('clingo-wasm');
      await clingo.init();
      return true;
    } catch {
      return false;
    }
  }

  getStats() {
    return { ...this.stats };
  }
}

/** Create a Clingo WASM oracle. */
export function createClingoWasmOracle(config: Partial<Omit<ClingoWasmOracleConfig, 'operation'>> = {}): ClingoWasmOracle {
  return new ClingoWasmOracle({
    operation: 'engine.clingo',
    provider: 'clingo-wasm',
    ...config,
  });
}