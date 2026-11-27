/**
 * Oracle Seam — the single gateway for all external/nondeterministic calls.
 *
 * Every external call in src/ must go through an Oracle implementation.
 * A new `fetch`/client import outside src/oracles fails the `one-oracle` gate.
 */
import { FunctionRegistry } from '../util/registry';
import { createLMGenerateTextOracle, createLMGenerateObjectOracle, createLMStreamOracle } from './lm';
import { createNLToFormalOracle, createFormalToNlOracle } from './formalization';
import { createEmbeddingGenerateOracle } from './embedding';
import { MockEmbeddingGenerator } from '../memory/embedding';
import { createHash } from 'crypto';
import { createZ3WasmOracle } from './engines/z3-wasm';
import { createClingoWasmOracle } from './engines/clingo-wasm';
import { createMiniSatWasmOracle } from './engines/minisat-wasm';
import { createTauPrologOracle } from './engines/tau-prolog';
import { createMettaOracle } from './engines/metta';
import { SenarsError } from '../errors/senars-error';
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
];
/** Base oracle implementation with common functionality. */
export class BaseOracle {
    operation;
    provider;
    version;
    budgetResource;
    telemetrySink;
    clock;
    ids;
    defaultBudgetSlice;
    stats = {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        pinnedCalls: 0,
        totalDurationMs: 0,
    };
    constructor(config) {
        this.operation = config.operation;
        this.provider = config.provider;
        this.version = config.version;
        this.budgetResource = config.budgetResource;
        this.defaultBudgetSlice = config.budgetSlice;
        this.telemetrySink = config.telemetry;
        this.clock = config.clock ?? { now: () => Date.now() };
        this.ids = config.ids ?? { uuid: () => crypto.randomUUID() };
    }
    async call(input, budgetSlice) {
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
        let error;
        let value;
        this.stats.totalCalls++;
        try {
            value = await this.execute(input);
            this.stats.successfulCalls++;
        }
        catch (e) {
            this.stats.failedCalls++;
            error = e instanceof Error ? e.message : String(e);
            // Fail-closed: return a safe default or rethrow based on operation
            value = await this.failClosed(input, error);
        }
        finally {
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
    /** Fail-closed behavior. Override for operation-specific defaults. */
    async failClosed(input, error) {
        throw new SenarsError(`Oracle ${this.operation} failed: ${error}`, 'VALIDATION_ERROR');
    }
    /** Emit telemetry event — forwarded to the wired log sink. */
    emitTelemetry(meta) {
        this.telemetrySink?.(meta);
    }
    async isAvailable() {
        return true;
    }
    getStats() {
        return { ...this.stats };
    }
}
/** Oracle registry — manages all oracle instances. */
export class OracleRegistry extends FunctionRegistry {
    pinStore = null;
    clock;
    ids;
    constructor(options = {}) {
        super((oracle) => oracle.operation, { unique: true, duplicateError: (op) => `Oracle for ${op} already registered` });
        this.clock = options.clock ?? { now: () => Date.now() };
        this.ids = options.ids ?? { uuid: () => crypto.randomUUID() };
    }
    /** Execute an oracle call with optional pinning and budget charging. */
    async call(operation, input, pinning = false, budgetSlice) {
        const oracle = this.get(operation);
        if (!oracle) {
            throw new SenarsError(`No oracle registered for ${operation}`, 'OPERATION_ERROR');
        }
        const queryDigest = createHash('sha256').update(JSON.stringify(input.args)).digest('hex').substring(0, 32);
        const pinKey = {
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
                    value: pinned,
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
        const result = await oracle.call(input, budgetSlice);
        if (pinning && this.pinStore && !result.meta.pinned) {
            await this.pinStore.pin(pinKey, result.value);
        }
        return result;
    }
    /** Set the pin store for deterministic replay. */
    setPinStore(store) {
        this.pinStore = store;
    }
    /** Get aggregate statistics. */
    getAggregateStats() {
        const stats = {};
        for (const oracle of this.getAll()) {
            stats[oracle.operation] = oracle.getStats();
        }
        return stats;
    }
}
/** Serialize a pin key to a string for storage. */
export function serializePinKey(key) {
    return `${key.operation}:${key.queryDigest}:${key.provider}:${key.version ?? ''}:${JSON.stringify(key.context ?? {})}`;
}
/** Deserialize a pin key from a string. */
export function deserializePinKey(serialized) {
    const parts = serialized.split(':');
    if (parts.length < 3)
        throw new SenarsError(`Invalid pin key: ${serialized}`, 'VALIDATION_ERROR');
    const operation = parts[0];
    const queryDigest = parts[1];
    const provider = parts[2];
    const rest = parts.slice(3);
    const version = rest[0] || undefined;
    const context = rest.length > 1 ? JSON.parse(rest.slice(1).join(':')) : undefined;
    return { operation: operation, queryDigest, provider, version, context };
}
/** Create an isolated oracle registry. */
export function createOracleRegistry(options) {
    return new OracleRegistry(options);
}
/** Create a fully configured oracle registry with standard oracles. */
export function createStandardOracleRegistry(lmService, pinStore) {
    const registry = new OracleRegistry();
    if (lmService && lmService.hasModel()) {
        const textOracle = createLMGenerateTextOracle(lmService);
        const objectOracle = createLMGenerateObjectOracle(lmService);
        const streamOracle = createLMStreamOracle(lmService);
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
    const nlToFormalOracle = createNLToFormalOracle(lmService);
    const formalToNlOracle = createFormalToNlOracle(lmService);
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
/** Create an oracle registry with engine oracles (WASM by default, native optional). */
export async function createEngineOracleRegistry(options = {}) {
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
export async function callOracle(operation, input, pinning = false) {
    return oracleRegistry.call(operation, input, pinning);
}
/** Register an oracle globally. */
export function registerOracle(oracle) {
    oracleRegistry.register(oracle);
}
