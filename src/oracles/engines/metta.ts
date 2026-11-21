/**
 * MeTTa Oracle — MeTTa evaluation/rewriting through the oracle seam.
 */

import { createHash } from 'crypto';
import type { Oracle, OracleInput, OracleOutput, OracleConfig } from '../oracle.js';
import { OraclePinStore } from '../pins.js';
import { parseMeTTa } from '../../metta/parser/runtime.js';
import { createMeTTa, type MeTTaRuntime } from '../../metta/runtime/builder.js';
import type { MeTTaAtom } from '../../metta/types/ast.js';

/** Input for MeTTa evaluation. */
export interface MettaInput extends OracleInput {
  operation: 'engine.metta';
  args: [expression: string, options?: MettaOptions];
}

/** MeTTa execution options. */
export interface MettaOptions {
  /** Timeout in milliseconds. */
  timeoutMs?: number;
  /** Maximum number of steps. */
  maxSteps?: number;
  /** Memory limit in bytes. */
  memoryLimit?: number;
  /** Space to evaluate in. */
  space?: string;
}

/** MeTTa execution result. */
export interface MettaResult {
  /** Result atoms. */
  results: MettaAtom[];
  /** Whether evaluation succeeded. */
  success: boolean;
  /** Error message if failed. */
  error?: string;
  /** Duration in ms. */
  durationMs: number;
}

/** MeTTa atom for JSON serialization. */
export type MettaAtom =
  | { kind: 'symbol'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'expression'; operator: MettaAtom; args: MettaAtom[] }
  | { kind: 'variable'; name: string }
  | { kind: 'grounded'; type: string; value: string };

/** MeTTa Oracle configuration. */
export interface MettaOracleConfig extends OracleConfig {
  operation: 'engine.metta';
  /** Default timeout. */
  defaultTimeoutMs?: number;
  /** Default max steps. */
  defaultMaxSteps?: number;
}

/** MeTTa Oracle implementation. */
export class MettaOracle implements Oracle<MettaInput, MettaResult> {
  public readonly operation: 'engine.metta' = 'engine.metta';
  public readonly provider: string = 'metta';
  public readonly version?: string;

  private runtime: MeTTaRuntime;
  private defaultTimeoutMs: number;
  private defaultMaxSteps: number;
  private pinStore: OraclePinStore | null = null;
  private isReplay = false;

  private stats = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    pinnedCalls: 0,
    totalDurationMs: 0,
  };

  constructor(config: MettaOracleConfig) {
    this.version = config.version;
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 30000;
    this.defaultMaxSteps = config.defaultMaxSteps ?? 1000;
    this.runtime = createMeTTa();
  }

  setPinStore(store: OraclePinStore): void {
    this.pinStore = store;
  }

  setReplayMode(replay: boolean): void {
    this.isReplay = replay;
  }

  async call(input: MettaInput): Promise<OracleOutput<MettaResult>> {
    const callId = crypto.randomUUID();
    const startTs = Date.now();
    let pinned = false;
    let error: string | undefined;
    let value: MettaResult;

    this.stats.totalCalls++;

    try {
      if (this.isReplay && this.pinStore) {
        const pinnedValue = await this.pinStore.getPin(this.operation, input.args);
        if (pinnedValue !== null) {
          this.stats.pinnedCalls++;
          this.stats.successfulCalls++;
          return {
            value: pinnedValue as MettaResult,
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

  private atomToJson(atom: MeTTaAtom): MettaAtom {
    switch (atom.kind) {
      case 0: // SymbolAtom
        return { kind: 'symbol', value: (atom as any).value };
      case 1: // VariableAtom
        return { kind: 'variable', name: (atom as any).name };
      case 2: // NumberAtom
        return { kind: 'number', value: (atom as any).value };
      case 3: // ExpressionAtom
        return {
          kind: 'expression',
          operator: this.atomToJson((atom as any).operator),
          args: (atom as any).args.map((a: MeTTaAtom) => this.atomToJson(a)),
        };
      case 4: // GroundedAtom
        return { kind: 'grounded', type: (atom as any).type, value: (atom as any).value };
      default:
        return { kind: 'symbol', value: String(atom) };
    }
  }

  private async execute(input: MettaInput): Promise<MettaResult> {
    const [expression, options] = input.args;
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const maxSteps = options?.maxSteps ?? this.defaultMaxSteps;
    const memoryLimit = options?.memoryLimit;

    const startTs = Date.now();

    try {
      const program = parseMeTTa(expression);

      const { Effect } = await import('effect');

      const result = await Effect.runPromise(
        this.runtime.evaluate(program, {
          maxSteps,
          timeout: timeoutMs,
          memoryLimit,
        })
      );

      const durationMs = Date.now() - startTs;

      return {
        success: true,
        results: [this.atomToJson(result)],
        durationMs,
      };
    } catch (e) {
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

  private hashInput(args: unknown[]): string {
    const json = JSON.stringify(args, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v
    );
    return createHash('sha256').update(json).digest('hex').substring(0, 32);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const testRuntime = createMeTTa();
      const { Effect } = await import('effect');
      const { parseMeTTa } = await import('../../metta/parser/runtime.js');
      await Effect.runPromise(testRuntime.evaluate(parseMeTTa('(= 1 1)')));
      return true;
    } catch {
      return false;
    }
  }

  getStats() {
    return { ...this.stats };
  }
}

/** Create a MeTTa oracle. */
export function createMettaOracle(config: Partial<Omit<MettaOracleConfig, 'operation'>> = {}): MettaOracle {
  return new MettaOracle({
    operation: 'engine.metta',
    provider: 'metta',
    ...config,
  });
}