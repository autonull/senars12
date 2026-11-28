/**
 * Oracle Seam — the single gateway for all external/nondeterministic calls.
 *
 * Every external call in src/ must go through an Oracle implementation.
 * A new `fetch`/client import outside src/oracles fails the `one-oracle` gate.
 */
import type { UUID, TimestampMs } from '../generated/schemas';
import { FunctionRegistry } from '../util/registry';
import { OraclePinStore } from './pins';
import type { BudgetSlice, BudgetResource } from '../budget/budget';
/** Oracle operation categories. */
export declare const ORACLE_OPERATIONS: readonly ['lm.generateText', 'lm.generateObject', 'lm.stream', 'retrieval.query', 'engine.z3', 'engine.clingo', 'engine.minisat', 'engine.tau-prolog', 'engine.metta', 'engine.custom', 'formalization.nlToFormal', 'formalization.formalToNl', 'embedding.generate', 'embedding.rerank', 'embedding.contrastiveScore', 'embedding.mineHardNegatives', 'distillation.record', 'distillation.fitCalibration', 'distillation.bakeOff', 'distillation.validateHead', 'distillation.loadLock', 'distillation.applyLock', 'gbnf.generateGrammar', 'gbnf.constrainedGenerate', 'gbnf.getActions', 'learnedHead.load', 'learnedHead.evaluate', 'learnedHead.health', 'cascade.groundedness', 'cascade.traceGrade', 'cascade.wakeGate', 'cascade.resourceCharge', 'creditAssignment.mcReturn', 'creditAssignment.recordMcReturn', 'creditAssignment.decide', 'creditAssignment.step', 'creditAssignment.runEpisode', 'imagination.generate', 'imagination.run', 'imagination.profiles', 'self.mod.tuneKnob', 'self.mod.switchStrategy', 'self.mod.shadowRun', 'self.mod.scaffoldCapability', 'self.mod.registerTool', 'self.mod.registerRule', 'self.mod.applyFix', 'transport.cli', 'transport.http', 'transport.ws', 'transport.irc', 'transport.mcp', 'transport.stdio'];
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
    tokens?: {
        prompt: number;
        completion: number;
        total: number;
    };
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
    retry?: {
        attempts: number;
        backoffMs: number;
    };
    /** Telemetry sink for every call (integrated into the event log). */
    telemetry?: OracleTelemetrySink;
    /** Clock (defaults to a monotonic source; inject for replay). */
    clock?: {
        now(): TimestampMs;
    };
    /** ID generator (defaults to `crypto.randomUUID`; inject for replay). */
    ids?: {
        uuid(): UUID;
    };
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
export declare abstract class BaseOracle<TInput extends OracleInput, TOutput> implements Oracle<TInput, TOutput> {
    readonly operation: OracleOperation;
    readonly provider: string;
    readonly version?: string;
    readonly budgetResource?: BudgetResource;
    private readonly telemetrySink?;
    private readonly clock;
    private readonly ids;
    private readonly defaultBudgetSlice?;
    protected stats: OracleStats;
    constructor(config: OracleConfig);
    call(input: TInput, budgetSlice?: BudgetSlice): Promise<OracleOutput<TOutput>>;
    /** Execute the actual oracle call. Override in subclasses. */
    protected abstract execute(input: TInput): Promise<TOutput>;
    /** Fail-closed behavior. Override for operation-specific defaults. */
    protected failClosed(input: TInput, error: string): Promise<TOutput>;
    /** Emit telemetry event — forwarded to the wired log sink. */
    protected emitTelemetry(meta: OracleMeta): void;
    isAvailable(): Promise<boolean>;
    getStats(): OracleStats;
}
/** Oracle registry — manages all oracle instances. */
export declare class OracleRegistry extends FunctionRegistry<OracleOperation, Oracle> {
    private pinStore;
    private readonly clock;
    private readonly ids;
    constructor(options?: {
        clock?: {
            now(): TimestampMs;
        };
        ids?: {
            uuid(): UUID;
        };
    });
    /** Execute an oracle call with optional pinning and budget charging. */
    call<TInput extends OracleInput, TOutput>(operation: OracleOperation, input: TInput, pinning?: boolean, budgetSlice?: BudgetSlice): Promise<OracleOutput<TOutput>>;
    /** Set the pin store for deterministic replay. */
    setPinStore(store: PinStore): void;
    /** Get aggregate statistics. */
    getAggregateStats(): Record<OracleOperation, OracleStats>;
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
export declare function serializePinKey(key: PinKey): string;
/** Deserialize a pin key from a string. */
export declare function deserializePinKey(serialized: string): PinKey;
/** Create an isolated oracle registry. */
export declare function createOracleRegistry(options?: ConstructorParameters<typeof OracleRegistry>[0]): OracleRegistry;
/** Create a fully configured oracle registry with standard oracles. */
export declare function createStandardOracleRegistry(lmService?: {
    hasModel(): boolean;
    getModel(task: string): unknown;
    provider?: string;
    model?: string;
} | null, pinStore?: OraclePinStore): OracleRegistry;
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
    nativePaths?: {
        z3?: string;
        clingo?: string;
        minisat?: string;
    };
}
/** Create an oracle registry with engine oracles (WASM by default, native optional). */
export declare function createEngineOracleRegistry(options?: EngineRegistryOptions): Promise<OracleRegistry>;
/** Global oracle registry instance (convenience; prefer {@link createOracleRegistry}). */
export declare const oracleRegistry: OracleRegistry;
/** Convenience function to call an oracle. */
export declare function callOracle<TInput extends OracleInput, TOutput>(operation: OracleOperation, input: TInput, pinning?: boolean): Promise<OracleOutput<TOutput>>;
/** Register an oracle globally. */
export declare function registerOracle(oracle: Oracle): void;
//# sourceMappingURL=oracle.d.ts.map