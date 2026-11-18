/**
 * Oracle Seam — the single gateway for all external/nondeterministic calls.
 *
 * Every external call in src/ must go through an Oracle implementation.
 * A new `fetch`/client import outside src/oracles fails the `one-oracle` gate.
 */

import type { UUID, TimestampMs } from '../generated/schemas.js';
import type { Term } from '../kernel/terms/term.js';
import type { Task } from '../kernel/types.js';

/** Oracle operation categories. */
export const ORACLE_OPERATIONS = [
  'lm.generateText',
  'lm.generateObject',
  'lm.stream',
  'retrieval.query',
  'engine.z3',
  'engine.clingo',
  'engine.minisat',
  'engine.tau-prolog',
  'engine.custom',
] as const;

export type OracleOperation = (typeof ORACLE_OPERATIONS)[number];

/** Input for an oracle call. */
export interface OracleInput {
  operation: OracleOperation;
  args: unknown[];
  /** Optional context for pinning/replay (e.g., model, temperature, seed). */
  context?: Record<string, unknown>;
}

/** Output from an oracle call. */
export interface OracleOutput<T = unknown> {
  value: T;
  /** Metadata about the call (latency, tokens, model, etc.). */
  meta: OracleMeta;
}

/** Metadata returned with every oracle call. */
export interface OracleMeta {
  /** Unique call ID for tracing. */
  callId: UUID;
  /** When the call was made. */
  ts: TimestampMs;
  /** Duration in milliseconds. */
  durationMs: number;
  /** Provider/engine that fulfilled the call. */
  provider: string;
  /** Model/engine version. */
  version?: string;
  /** Token usage (for LM calls). */
  tokens?: { prompt: number; completion: number; total: number };
  /** Whether the result came from a pin (replay). */
  pinned: boolean;
  /** Error if the call failed (fail-closed). */
  error?: string;
}

/** Configuration for an oracle. */
export interface OracleConfig {
  /** Operation name this oracle handles. */
  operation: OracleOperation;
  /** Provider identifier (e.g., 'openai', 'llamacpp', 'z3'). */
  provider: string;
  /** Model/engine version. */
  version?: string;
  /** Whether to enable pinning for deterministic replay. */
  pinning?: boolean;
  /** Timeout in milliseconds. */
  timeoutMs?: number;
  /** Retry configuration. */
  retry?: { attempts: number; backoffMs: number };
}

/** The Oracle interface — all external calls implement this. */
export interface Oracle<TInput extends OracleInput = OracleInput, TOutput = unknown> {
  /** The operation this oracle handles. */
  readonly operation: OracleOperation;
  /** The provider this oracle uses. */
  readonly provider: string;
  /** Model/engine version. */
  readonly version?: string;

  /** Execute the oracle call. */
  call(input: TInput): Promise<OracleOutput<TOutput>>;

  /** Check if the oracle is available. */
  isAvailable(): Promise<boolean>;

  /** Get oracle statistics. */
  getStats(): OracleStats;
}

/** Oracle call statistics. */
export interface OracleStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  pinnedCalls: number;
  totalDurationMs: number;
  totalTokens?: number;
  lastError?: string;
}

/** Base oracle implementation with common functionality. */
export abstract class BaseOracle<TInput extends OracleInput, TOutput> implements Oracle<TInput, TOutput> {
  public readonly operation: OracleOperation;
  public readonly provider: string;
  public readonly version?: string;

  protected stats: OracleStats = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    pinnedCalls: 0,
    totalDurationMs: 0,
  };

  constructor(config: OracleConfig) {
    this.operation = config.operation;
    this.provider = config.provider;
    this.version = config.version;
  }

  async call(input: TInput): Promise<OracleOutput<TOutput>> {
    const callId = crypto.randomUUID() as UUID;
    const startTs = Date.now() as TimestampMs;
    const durationMs = 0;
    let pinned = false;
    let error: string | undefined;
    let value: TOutput;

    this.stats.totalCalls++;

    try {
      value = await this.execute(input);
      this.stats.successfulCalls++;
    } catch (e) {
      this.stats.failedCalls++;
      error = e instanceof Error ? e.message : String(e);
      // Fail-closed: return a safe default or rethrow based on operation
      value = await this.failClosed(input, error);
    } finally {
      const endTs = Date.now();
      const actualDuration = endTs - startTs;
      this.stats.totalDurationMs += actualDuration;

      // Emit telemetry event
      this.emitTelemetry({
        callId,
        ts: startTs,
        durationMs: actualDuration,
        provider: this.provider,
        version: this.version,
        pinned,
        error,
      });
    }

    return {
      value,
      meta: {
        callId,
        ts: startTs,
        durationMs,
        provider: this.provider,
        version: this.version,
        pinned,
        error,
      },
    };
  }

  /** Execute the actual oracle call. Override in subclasses. */
  protected abstract execute(input: TInput): Promise<TOutput>;

  /** Fail-closed behavior. Override for operation-specific defaults. */
  protected async failClosed(input: TInput, error: string): Promise<TOutput> {
    throw new Error(`Oracle ${this.operation} failed: ${error}`);
  }

  /** Emit telemetry event. Override to integrate with log/events. */
  protected emitTelemetry(meta: OracleMeta): void {
    // Hook for log integration
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getStats(): OracleStats {
    return { ...this.stats };
  }
}

/** Oracle registry — manages all oracle instances. */
export class OracleRegistry {
  private oracles = new Map<OracleOperation, Oracle>();
  private pinStore: PinStore | null = null;

  /** Register an oracle. */
  register(oracle: Oracle): void {
    if (this.oracles.has(oracle.operation)) {
      throw new Error(`Oracle for ${oracle.operation} already registered`);
    }
    this.oracles.set(oracle.operation, oracle);
  }

  /** Get an oracle by operation. */
  get(operation: OracleOperation): Oracle | undefined {
    return this.oracles.get(operation);
  }

  /** Get all registered oracles. */
  getAll(): Oracle[] {
    return Array.from(this.oracles.values());
  }

  /** Check if an operation has a registered oracle. */
  has(operation: OracleOperation): boolean {
    return this.oracles.has(operation);
  }

  /** Execute an oracle call with optional pinning. */
  async call<TInput extends OracleInput, TOutput>(
    operation: OracleOperation,
    input: TInput,
    pinning = false
  ): Promise<OracleOutput<TOutput>> {
    const oracle = this.oracles.get(operation);
    if (!oracle) {
      throw new Error(`No oracle registered for ${operation}`);
    }

    if (pinning && this.pinStore) {
      // Check pin store first
      const pinKey = `${operation}:${JSON.stringify(input.args)}`;
      const pinned = await this.pinStore.getPin(pinKey);
      if (pinned !== null) {
        return {
          value: pinned as TOutput,
          meta: {
            callId: crypto.randomUUID() as UUID,
            ts: Date.now() as TimestampMs,
            durationMs: 0,
            provider: oracle.provider,
            version: oracle.version,
            pinned: true,
          },
        };
      }
    }

    const result = await oracle.call(input) as OracleOutput<TOutput>;

    if (pinning && this.pinStore && !result.meta.pinned) {
      const pinKey = `${operation}:${JSON.stringify(input.args)}`;
      await this.pinStore.pin(pinKey, result.value);
    }

    return result;
  }

  /** Set the pin store for deterministic replay. */
  setPinStore(store: PinStore): void {
    this.pinStore = store;
  }

  /** Get aggregate statistics. */
  getAggregateStats(): Record<OracleOperation, OracleStats> {
    const stats: Partial<Record<OracleOperation, OracleStats>> = {};
    for (const [op, oracle] of this.oracles) {
      stats[op] = oracle.getStats();
    }
    return stats as Record<OracleOperation, OracleStats>;
  }
}

/** Pin store interface for deterministic replay. */
export interface PinStore {
  /** Get a pinned value. */
  getPin(key: string): Promise<unknown | null>;
  /** Store a pinned value. */
  pin(key: string, value: unknown): Promise<void>;
  /** Check if a pin exists. */
  hasPin(key: string): boolean;
}

/** Global oracle registry instance. */
export const oracleRegistry = new OracleRegistry();

/** Convenience function to call an oracle. */
export async function callOracle<TInput extends OracleInput, TOutput>(
  operation: OracleOperation,
  input: TInput,
  pinning = false
): Promise<OracleOutput<TOutput>> {
  return oracleRegistry.call(operation, input, pinning);
}

/** Register an oracle globally. */
export function registerOracle(oracle: Oracle): void {
  oracleRegistry.register(oracle);
}