/**
 * Z3 WASM Oracle — SMT solving through the oracle seam using z3-solver (WASM).
 */

import { createHash } from 'crypto';
import type { Oracle, OracleInput, OracleOutput, OracleConfig } from '../oracle';
import type { BudgetSlice, BudgetResource } from '../../budget/budget';
import { OraclePinStore } from '../pins';
import { SenarsError } from '../../errors/senars-error';


/** Input for Z3 SMT solving. */
export interface Z3WasmInput extends OracleInput {
  operation: 'engine.z3';
  args: [script: string, options?: Z3WasmOptions];
}

/** Z3 execution options. */
export interface Z3WasmOptions {
  /** Timeout in milliseconds. */
  timeoutMs?: number;
  /** Additional command-line arguments (passed to solver config). */
  args?: string[];
  /** Input format: 'smtlib2' | 'smtlib1' */
  format?: 'smtlib2' | 'smtlib1';
}

/** Z3 execution result. */
export interface Z3WasmResult {
  /** Solver result: 'sat', 'unsat', 'unknown'. */
  result: 'sat' | 'unsat' | 'unknown';
  /** Model (if sat). */
  model?: string;
  /** Proof (if unsat). */
  proof?: string;
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

/** Z3 WASM Oracle configuration. */
export interface Z3WasmOracleConfig extends OracleConfig {
  operation: 'engine.z3';
  /** Default timeout. */
  defaultTimeoutMs?: number;
  /** Default format. */
  defaultFormat?: 'smtlib2' | 'smtlib1';
}

/** Z3 WASM Oracle implementation. */
export class Z3WasmOracle implements Oracle<Z3WasmInput, Z3WasmResult> {
  public readonly operation: 'engine.z3' = 'engine.z3';
  public readonly provider: string = 'z3-wasm';
  public readonly version?: string;
  public readonly budgetResource?: BudgetResource;

  private defaultTimeoutMs: number;
  private defaultFormat: 'smtlib2' | 'smtlib1';
  private pinStore: OraclePinStore | null = null;
  private isReplay = false;
  private defaultBudgetSlice?: BudgetSlice;

  private stats = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    pinnedCalls: 0,
    totalDurationMs: 0,
  };

  constructor(config: Z3WasmOracleConfig) {
    this.version = config.version;
    this.budgetResource = config.budgetResource;
    this.defaultBudgetSlice = config.budgetSlice;
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 30000;
    this.defaultFormat = config.defaultFormat ?? 'smtlib2';
  }

  setPinStore(store: OraclePinStore): void {
    this.pinStore = store;
  }

  setReplayMode(replay: boolean): void {
    this.isReplay = replay;
  }

  async call(input: Z3WasmInput, budgetSlice?: BudgetSlice): Promise<OracleOutput<Z3WasmResult>> {
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
          value: { result: 'unknown' as const, stdout: '', stderr: '', exitCode: -1, durationMs: 0 },
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
    let error: string | undefined;
    let value: Z3WasmResult;

    this.stats.totalCalls++;

    try {
      if (this.isReplay && this.pinStore) {
        const pinnedValue = await this.pinStore.getPin(this.operation, input.args, this.provider, this.version, input.context);
        if (pinnedValue !== null) {
          this.stats.pinnedCalls++;
          this.stats.successfulCalls++;
          return {
            value: pinnedValue as Z3WasmResult,
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

  private async execute(input: Z3WasmInput): Promise<Z3WasmResult> {
    const [script, options] = input.args;
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const format = options?.format ?? this.defaultFormat;

    // Import z3-solver dynamically
    const { init } = await import('z3-solver');
    const { Context } = await init();

    const startTs = Date.now();
    const ctx = new Context('main');
    const solver = new ctx.Solver();

    return new Promise<Z3WasmResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new SenarsError(`Z3 WASM query timeout after ${timeoutMs}ms`, 'TIMEOUT'));
      }, timeoutMs);

      try {
        // Parse SMT-LIB2 script using fromString
        if (format === 'smtlib2') {
          solver.fromString(script);
        } else {
          // For SMTLIB1, we'd need different parsing
          solver.fromString(script);
        }

        solver.check().then((result) => {
          const durationMs = Date.now() - startTs;
          clearTimeout(timeout);

          const output: Z3WasmResult = {
            result,
            stdout: '',
            stderr: '',
            exitCode: result === 'sat' ? 0 : result === 'unsat' ? 0 : 1,
            durationMs,
          };

          if (result === 'sat') {
            const model = solver.model();
            output.model = model.toString();
          } else if (result === 'unsat') {
            // Z3 doesn't provide proofs easily in the high-level API
            output.proof = 'unsat';
          }

          resolve(output);
        }).catch((e) => {
          clearTimeout(timeout);
          reject(e);
        });
      } catch (e) {
        clearTimeout(timeout);
        reject(e);
      }
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
      const { init } = await import('z3-solver');
      await init();
      return true;
    } catch {
      return false;
    }
  }

  getStats() {
    return { ...this.stats };
  }
}

/** Create a Z3 WASM oracle. */
export function createZ3WasmOracle(config: Partial<Omit<Z3WasmOracleConfig, 'operation'>> = {}): Z3WasmOracle {
  return new Z3WasmOracle({
    operation: 'engine.z3',
    provider: 'z3-wasm',
    ...config,
  });
}