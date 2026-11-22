/**
 * Oracle Seam — the single gateway for all external/nondeterministic calls.
 *
 * Every external call in src/ must go through an Oracle implementation.
 * A new `fetch`/client import outside src/oracles fails the `one-oracle` gate.
 */

import type { UUID, TimestampMs } from '../generated/schemas';
import type { Term } from '../kernel/terms/term';
import type { Task } from '../kernel/types';
import { FunctionRegistry } from '../util/registry';
import { createLMGenerateTextOracle, createLMGenerateObjectOracle, createLMStreamOracle } from './lm';
import { createNLToFormalOracle, createFormalToNlOracle } from './formalization';
import { createEmbeddingGenerateOracle, createEmbeddingRerankOracle } from './embedding';
import { MockEmbeddingGenerator } from '../memory/embedding';
import { OraclePinStore } from './pins';
import { createHash } from 'crypto';
import type { BudgetSlice, BudgetResource } from '../budget/budget';
import { createZ3WasmOracle } from './engines/z3-wasm';
import { createClingoWasmOracle } from './engines/clingo-wasm';
import { createMiniSatWasmOracle } from './engines/minisat-wasm';
import { createTauPrologOracle } from './engines/tau-prolog';
import { createMettaOracle } from './engines/metta';

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
  'engine.metta',
  'engine.custom',
  'formalization.nlToFormal',
  'formalization.formalToNl',
  'embedding.generate',
  'embedding.rerank',
  'embedding.contrastiveScore',
  'embedding.mineHardNegatives',
  'distillation.record',
  'distillation.fitCalibration',
  'distillation.bakeOff',
  'distillation.validateHead',
  'distillation.loadLock',
  'distillation.applyLock',
  'gbnf.generateGrammar',
  'gbnf.constrainedGenerate',
  'gbnf.getActions',
  'learnedHead.load',
  'learnedHead.evaluate',
  'learnedHead.health',
  'cascade.groundedness',
  'cascade.traceGrade',
  'cascade.wakeGate',
  'cascade.resourceCharge',
  'creditAssignment.mcReturn',
  'creditAssignment.recordMcReturn',
  'creditAssignment.decide',
  'creditAssignment.step',
  'creditAssignment.runEpisode',
  'imagination.generate',
  'imagination.run',
  'imagination.profiles',
  'self.mod.tuneKnob',
  'self.mod.switchStrategy',
  'self.mod.shadowRun',
  'self.mod.scaffoldCapability',
  'self.mod.registerTool',
  'self.mod.registerRule',
  'self.mod.applyFix',
  'transport.cli',
  'transport.http',
  'transport.ws',
  'transport.irc',
  'transport.mcp',
  'transport.stdio',
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

/** Telemetry sink for oracle calls — wired to the log by the caller. */
export type OracleTelemetrySink = (meta: OracleMeta) => void;

/** Configuration for an oracle. */
export interface OracleConfig {
  /** Operation name this oracle handles. */
  operation: OracleOperation;
  /** Provider identifier (e.g., 'openai', 'llamacpp', 'z3'). */
  provider: string;
  /** Model/engine version. */
  version?: string;
  /** Budget resource to charge for this oracle's calls. */
  budgetResource?: BudgetResource;
  /** Default budget slice for charging (can be overridden per-call). */
  budgetSlice?: BudgetSlice;
  /** Whether to enable pinning for deterministic replay. */
  pinning?: boolean;
  /** Timeout in milliseconds. */
  timeoutMs?: number;
  /** Retry configuration. */
  retry?: { attempts: number; backoffMs: number };
  /** Telemetry sink for every call (integrated into the event log). */
  telemetry?: OracleTelemetrySink;
  /** Clock (defaults to a monotonic source; inject for replay). */
  clock?: { now(): TimestampMs };
  /** ID generator (defaults to `crypto.randomUUID`; inject for replay). */
  ids?: { uuid(): UUID };
}

/** The Oracle interface — all external calls implement this. */
export interface Oracle<TInput extends OracleInput = OracleInput, TOutput = unknown> {
  /** The operation this oracle handles. */
  readonly operation: OracleOperation;
  /** The provider this oracle uses. */
  readonly provider: string;
  /** Model/engine version. */
  readonly version?: string;
  /** Budget resource to charge for this oracle's calls. */
  readonly budgetResource?: BudgetResource;

  /** Execute the oracle call. */
  call(input: TInput, budgetSlice?: BudgetSlice): Promise<OracleOutput<TOutput>>;

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
  public readonly budgetResource?: BudgetResource;

  private readonly telemetrySink?: OracleTelemetrySink;
  private readonly clock: { now(): TimestampMs };
  private readonly ids: { uuid(): UUID };
  private readonly defaultBudgetSlice?: BudgetSlice;

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
    this.budgetResource = config.budgetResource;
    this.defaultBudgetSlice = config.budgetSlice;
    this.telemetrySink = config.telemetry;
    this.clock = config.clock ?? { now: () => Date.now() as TimestampMs };
    this.ids = config.ids ?? { uuid: () => crypto.randomUUID() as UUID };
  }

  async call(input: TInput, budgetSlice?: BudgetSlice): Promise<OracleOutput<TOutput>> {
    // Charge budget if configured
    const effectiveBudgetSlice = budgetSlice ?? this.defaultBudgetSlice;
    if (effectiveBudgetSlice && this.budgetResource) {
      const { consume } = await import('../budget/budget');
      const charged = consume(effectiveBudgetSlice, this.budgetResource, 1);
      if (!charged) {
        // Budget exhausted - fail closed
        const callId = this.ids.uuid();
        const startTs = this.clock.now();
        this.stats.totalCalls++;
        this.stats.failedCalls++;
        const error = `Budget exhausted for ${this.budgetResource}`;
        this.emitTelemetry({
          callId,
          ts: startTs,
          durationMs: 0,
          provider: this.provider,
          version: this.version,
          pinned: false,
          error,
        });
        return {
          value: await this.failClosed(input, error),
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

    const callId = this.ids.uuid();
    const startTs = this.clock.now();
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
      const endTs = this.clock.now();
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

    const endTs = this.clock.now();
    const actualDuration = endTs - startTs;

    return {
      value,
      meta: {
        callId,
        ts: startTs,
        durationMs: actualDuration,
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

  /** Emit telemetry event — forwarded to the wired log sink. */
  protected emitTelemetry(meta: OracleMeta): void {
    this.telemetrySink?.(meta);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getStats(): OracleStats {
    return { ...this.stats };
  }
}

/** Oracle registry — manages all oracle instances. */
export class OracleRegistry extends FunctionRegistry<OracleOperation, Oracle> {
  private pinStore: PinStore | null = null;
  private readonly clock: { now(): TimestampMs };
  private readonly ids: { uuid(): UUID };

  constructor(options: { clock?: { now(): TimestampMs }; ids?: { uuid(): UUID } } = {}) {
    super((oracle) => oracle.operation, { unique: true, duplicateError: (op) => `Oracle for ${op} already registered` });
    this.clock = options.clock ?? { now: () => Date.now() as TimestampMs };
    this.ids = options.ids ?? { uuid: () => crypto.randomUUID() as UUID };
  }

  /** Execute an oracle call with optional pinning and budget charging. */
  async call<TInput extends OracleInput, TOutput>(
    operation: OracleOperation,
    input: TInput,
    pinning = false,
    budgetSlice?: BudgetSlice
  ): Promise<OracleOutput<TOutput>> {
    const oracle = this.get(operation);
    if (!oracle) {
      throw new Error(`No oracle registered for ${operation}`);
    }

    const queryDigest = createHash('sha256').update(JSON.stringify(input.args)).digest('hex').substring(0, 32);
    const pinKey: PinKey = {
      operation,
      queryDigest,
      provider: oracle.provider,
      version: oracle.version,
      context: input.context,
    };

    if (pinning && this.pinStore) {
      // Check pin store first
      const pinned = await this.pinStore.getPin(pinKey);
      if (pinned !== null) {
        return {
          value: pinned as TOutput,
          meta: {
            callId: this.ids.uuid(),
            ts: this.clock.now(),
            durationMs: 0,
            provider: oracle.provider,
            version: oracle.version,
            pinned: true,
          },
        };
      }
    }

    const result = await oracle.call(input, budgetSlice) as OracleOutput<TOutput>;

    if (pinning && this.pinStore && !result.meta.pinned) {
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
    for (const oracle of this.getAll()) {
      stats[oracle.operation] = oracle.getStats();
    }
    return stats as Record<OracleOperation, OracleStats>;
  }
}

/** Pin key components for deterministic replay. */
export interface PinKey {
  operation: OracleOperation;
  queryDigest: string;
  provider: string;
  version?: string;
  context?: Record<string, unknown>;
}

/** Pin store interface for deterministic replay. */
export interface PinStore {
  /** Get a pinned value. */
  getPin(key: PinKey): Promise<unknown | null>;
  /** Store a pinned value. */
  pin(key: PinKey, value: unknown): Promise<void>;
  /** Check if a pin exists. */
  hasPin(key: PinKey): boolean;
}

/** Serialize a pin key to a string for storage. */
export function serializePinKey(key: PinKey): string {
  return `${key.operation}:${key.queryDigest}:${key.provider}:${key.version ?? ''}:${JSON.stringify(key.context ?? {})}`;
}

/** Deserialize a pin key from a string. */
export function deserializePinKey(serialized: string): PinKey {
  const parts = serialized.split(':');
  if (parts.length < 3) throw new Error(`Invalid pin key: ${serialized}`);
  const operation = parts[0]!;
  const queryDigest = parts[1]!;
  const provider = parts[2]!;
  const rest = parts.slice(3);
  const version = rest[0] || undefined;
  const context = rest.length > 1 ? JSON.parse(rest.slice(1).join(':')) : undefined;
  return { operation: operation as OracleOperation, queryDigest, provider, version, context };
}

/** Create an isolated oracle registry. */
export function createOracleRegistry(options?: ConstructorParameters<typeof OracleRegistry>[0]): OracleRegistry {
  return new OracleRegistry(options);
}

/** Create a fully configured oracle registry with standard oracles. */
export function createStandardOracleRegistry(
  lmService?: { hasModel(): boolean; getModel(task: string): unknown; provider?: string; model?: string } | null,
  pinStore?: OraclePinStore
): OracleRegistry {
  const registry = new OracleRegistry();

  if (lmService && lmService.hasModel()) {
    const textOracle = createLMGenerateTextOracle(lmService as any);
    const objectOracle = createLMGenerateObjectOracle(lmService as any);
    const streamOracle = createLMStreamOracle(lmService as any);

    if (pinStore) {
      textOracle.setPinStore(pinStore);
      objectOracle.setPinStore(pinStore);
      streamOracle.setPinStore(pinStore);
    }

    registry.register(textOracle);
    registry.register(objectOracle);
    registry.register(streamOracle);
  }

  // Always register formalization oracles (they work with or without LM)
  const nlToFormalOracle = createNLToFormalOracle(lmService as any);
  const formalToNlOracle = createFormalToNlOracle(lmService as any);

  if (pinStore) {
    nlToFormalOracle.setPinStore(pinStore);
    formalToNlOracle.setPinStore(pinStore);
  }

  registry.register(nlToFormalOracle);
  registry.register(formalToNlOracle);

  // Always register embedding oracles (they work with or without LM)
  const mockEmbedder = new MockEmbeddingGenerator();
  const embeddingGenerateOracle = createEmbeddingGenerateOracle(mockEmbedder, undefined);

  if (pinStore) {
    embeddingGenerateOracle.setPinStore(pinStore);
  }

  registry.register(embeddingGenerateOracle);

  return registry;
}

/** Engine oracle registration options. */
export interface EngineRegistryOptions {
  /** Pin store for deterministic replay. */
  pinStore?: OraclePinStore;
  /** Budget slice for charging engine calls. */
  budgetSlice?: BudgetSlice;
  /** Budget resource for engine calls. */
  budgetResource?: BudgetResource;
  /** Whether to include native (child_process-based) engines as optional high-power providers.
   *  Native engines require the binary to be installed (server-only). */
  includeNative?: boolean;
  /** Custom paths for native binaries. */
  nativePaths?: { z3?: string; clingo?: string; minisat?: string };
}

/** Create an oracle registry with engine oracles (WASM by default, native optional). */
export async function createEngineOracleRegistry(
  options: EngineRegistryOptions = {}
): Promise<OracleRegistry> {
  const registry = new OracleRegistry();
  const { pinStore, budgetSlice, budgetResource, includeNative = false, nativePaths = {} } = options;

  // Register WASM engines (default, portable)
  const z3Wasm = createZ3WasmOracle({ budgetSlice, budgetResource });
  const clingoWasm = createClingoWasmOracle({ budgetSlice, budgetResource });
  const minisatWasm = createMiniSatWasmOracle({ budgetSlice, budgetResource });
  const tauProlog = createTauPrologOracle({ budgetSlice, budgetResource });
  const metta = createMettaOracle({ budgetSlice, budgetResource });

  if (pinStore) {
    z3Wasm.setPinStore(pinStore);
    clingoWasm.setPinStore(pinStore);
    minisatWasm.setPinStore(pinStore);
    tauProlog.setPinStore(pinStore);
    metta.setPinStore(pinStore);
  }

  registry.register(z3Wasm);
  registry.register(clingoWasm);
  registry.register(minisatWasm);
  registry.register(tauProlog);
  registry.register(metta);

  // Optionally register native engines (server-only, high-power)
  if (includeNative) {
    const { createZ3Oracle } = await import('./engines/z3');
    const { createClingoOracle } = await import('./engines/clingo');
    const { createMiniSatOracle } = await import('./engines/minisat');

    const z3Native = createZ3Oracle({
      budgetSlice,
      budgetResource,
      z3Path: nativePaths.z3,
    });
    const clingoNative = createClingoOracle({
      budgetSlice,
      budgetResource,
      clingoPath: nativePaths.clingo,
    });
    const minisatNative = createMiniSatOracle({
      budgetSlice,
      budgetResource,
      minisatPath: nativePaths.minisat,
    });

    if (pinStore) {
      z3Native.setPinStore(pinStore);
      clingoNative.setPinStore(pinStore);
      minisatNative.setPinStore(pinStore);
    }

    // Register with distinct provider names to avoid conflicts
    registry.register(z3Native);
    registry.register(clingoNative);
    registry.register(minisatNative);
  }

  return registry;
}

/** Global oracle registry instance (convenience; prefer {@link createOracleRegistry}). */
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