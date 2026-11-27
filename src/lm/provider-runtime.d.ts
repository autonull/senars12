/**
 * Scoped provider runtime state (TODO20 X3) — routing policy, demotions,
 * circuit breakers, and routing telemetry log. The module-level default
 * instance (`getProviderRuntime`) preserves the historical global API; a
 * fresh instance gives a NAR/LMService its own routing + failure state so
 * parallel instances coexist in one process.
 */
import type { LMTask } from '@senars/types/llm';
import type { LanguageModel } from 'ai';
import { type CircuitBreakerSettings, type CircuitSnapshot } from '@senars/util/circuit-breaker';
import { type CircuitState, type LMProviderName, type LMSettings, type LMSettingsInput } from './env-config';
export type { CircuitState, CircuitBreakerSettings, LMProviderName };
/** Browser-side WebLLM runtime, injected by the UI layer (nar never imports browser code). */
export interface WebLLMRuntime {
    createModel: (modelKey: string, onProgress?: (progress: number) => void) => LanguageModel;
    models: Record<string, {
        id: string;
        label?: string;
    }>;
}
/**
 * Objective-driven routing override. Candidates are SeNARS model ids
 * (e.g. "cloud:quality"); the offline failsafe ladder is always appended.
 * Constraints (offlineOnly, maxLatencyMs) act as hard filters.
 */
export interface RoutingPolicy {
    candidates?: string[];
    offlineOnly?: boolean;
    maxLatencyMs?: number;
    /** Per-task objectives; per-task constraints override the global ones. */
    objectives?: Partial<Record<LMTask, RoutingObjective>>;
    /** Offline failsafe ladder, smallest → most capable local model ids. */
    offlineLadder?: string[];
}
export declare const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerSettings;
export type QualityObjective = 'balanced' | 'high' | 'max';
export interface RoutingObjective {
    quality?: QualityObjective;
    maxLatencyMs?: number;
    offlineOnly?: boolean;
}
export interface RoutingDecision {
    task: LMTask;
    modelId: string;
    reason: 'primary' | 'failover';
}
/** Sensible per-provider defaults. */
export declare const PROVIDER_CIRCUIT_DEFAULTS: Partial<Record<LMProviderName, Partial<CircuitBreakerSettings>>>;
/** A provider's breaker state, plus when it was last probed and how that went. */
export interface ProviderHealth extends CircuitSnapshot {
    provider: LMProviderName;
    lastProbe: number | null;
    probeResult: boolean | null;
}
export interface RoutingTelemetryEntry {
    ts: number;
    task: LMTask;
    modelId: string;
    latencyMs: number;
    success: boolean;
    demoted: boolean;
    provider: string;
    objective?: RoutingObjective;
    chain?: string[];
}
export declare class ProviderRuntime {
    #private;
    routing: RoutingPolicy | null;
    lastDecision: RoutingDecision | undefined;
    /** Session-level demotions: a demoted model sinks to the back of the chain. */
    readonly demotions: Map<string, {
        reason: string;
        at: number;
    }>;
    readonly circuitBreakers: Map<"anthropic" | "llamacpp" | "llamacpp-embedded" | "mock" | "openai" | "openai-compatible" | "transformers" | "webllm", CircuitBreaker>;
    /** Disposer owned by start/stopHealthProbes (providers.ts). */
    healthProbeInterval: (() => void) | null;
    private fileSettings;
    /**
     * Runtime provider selection (lm.switch). Beats env/file at read time, so a
     * switch is instant and needs no registry rebuild — every configured provider
     * is already built (see `createSeNARSRegistry`), this only picks the default
     * chain. Cleared by `setActiveProvider(undefined)`.
     */
    private activeProviderOverride;
    private webllmRuntime;
    private builtinProgressCallback;
    routingLogEnabled: boolean;
    routingLogDir: string;
    routingLogInterval: (() => void) | null;
    /** Install file/config-derived settings (env still wins at read time). */
    configureLM(settings: LMSettingsInput): void;
    /** Active settings, lazily resolved from env (+ anything installed via configureLM). */
    getLMSettings(): LMSettings;
    /** Select the runtime-active provider (and optional model). Undefined clears it. */
    setActiveProvider(provider: LMProviderName | undefined, model?: string): void;
    getActiveProvider(): {
        provider: LMProviderName;
        model?: string;
    } | undefined;
    /** UI layer installs the WebLLM runtime at startup (browser only). */
    configureWebLLM(runtime: WebLLMRuntime | undefined): void;
    getWebLLMRuntime(): WebLLMRuntime | undefined;
    setBuiltinProgressCallback(cb: ((progress: number) => void) | undefined): void;
    getBuiltinProgressCallback(): ((progress: number) => void) | undefined;
    setRouting(policy: RoutingPolicy | null): void;
    getRouting(): RoutingPolicy | null;
    demoteModel(id: string, reason: string): void;
    resetDemotions(): void;
    getRoutingStatus(): {
        policy: RoutingPolicy | null;
        demoted: Array<{
            id: string;
            reason: string;
            at: number;
        }>;
        lastDecision: RoutingDecision | undefined;
    };
    /** Effective circuit breaker config for a provider (settings > provider defaults > global defaults). */
    getEffectiveCircuitConfig(provider: LMProviderName, settings?: LMSettings): CircuitBreakerSettings;
    /** Live breaker state for a provider, including out-of-band probe results. */
    breaker(provider: LMProviderName): ProviderHealth;
    /** Record an out-of-band health probe; a success on an open circuit re-admits it. */
    recordProbe(provider: LMProviderName, ok: boolean): void;
    getCircuitBreaker(provider: LMProviderName): ProviderHealth;
    getAllCircuitBreakers(): Map<LMProviderName, ProviderHealth>;
    /** Close all breakers and clear failure counts (test/bench isolation between independent scenarios). */
    resetCircuitBreakers(): void;
    recordProviderCall(provider: LMProviderName, success: boolean, settings?: LMSettings): void;
    canUseProvider(provider: LMProviderName, settings?: LMSettings): boolean;
    enableRoutingTelemetry(options?: {
        logDir?: string;
        flushIntervalMs?: number;
    }): void;
    disableRoutingTelemetry(): void;
    logRoutingDecision(entry: RoutingTelemetryEntry): void;
    getRoutingLogStatus(): {
        enabled: boolean;
        bufferSize: number;
        logPath: string;
    };
    private flushRoutingLog;
}
/** Process-wide default instance backing the module-level provider API. */
export declare const getProviderRuntime: () => ProviderRuntime;
/** The {@link ProviderRuntime} keys that are callable — what {@link delegate} covers. */
export type RuntimeMethod = {
    [K in keyof ProviderRuntime]-?: ProviderRuntime[K] extends (...args: never[]) => unknown ? K : never;
}[keyof ProviderRuntime];
/**
 * A runtime method as a module-level function: the method's own arguments, then
 * an optional runtime. Twenty-nine call sites were the same three lines —
 * `(args, rt = getProviderRuntime()) => rt.method(args)` — which means the
 * ambient/scoped choice was re-derived per function and a signature that drifted
 * from the method it forwards to still compiled. Here the two cannot differ,
 * because the type is the method's.
 */
export type Delegated<K extends RuntimeMethod> = (...args: [...Parameters<ProviderRuntime[K]>, ProviderRuntime?]) => ReturnType<ProviderRuntime[K]>;
/** A runtime field as a module-level read. */
export type DelegatedRead<K extends keyof ProviderRuntime> = (rt?: ProviderRuntime) => ProviderRuntime[K];
/** Bind one `ProviderRuntime` method to the module-level provider API. */
export declare const delegate: <K extends RuntimeMethod>(key: K) => Delegated<K>;
/** Bind one `ProviderRuntime` field to the module-level provider API. */
export declare const readField: <K extends keyof ProviderRuntime>(key: K) => DelegatedRead<K>;
//# sourceMappingURL=provider-runtime.d.ts.map