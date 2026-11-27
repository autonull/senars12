/**
 * Scoped provider runtime state (TODO20 X3) — routing policy, demotions,
 * circuit breakers, and routing telemetry log. The module-level default
 * instance (`getProviderRuntime`) preserves the historical global API; a
 * fresh instance gives a NAR/LMService its own routing + failure state so
 * parallel instances coexist in one process.
 */
import { join } from 'node:path';
import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { ensureDirSync } from '@senars/util/fs';
import { getOrInsert, indexBy } from '@senars/util/collections';
import { periodic } from '@senars/util/async';
import { utcDate } from '@senars/util/format';
import { BaseLedgerEntrySchema, createLedger } from '@senars/util/ledger';
import { z } from 'zod';
import { recordCircuitBreakerState } from '../metrics/index';
import { getTracer } from '../otel/index';
import { CircuitBreaker, } from '@senars/util/circuit-breaker';
import { resolveLMSettings, } from './env-config';
export const DEFAULT_CIRCUIT_CONFIG = {
    failureThreshold: 5,
    resetTimeoutMs: 30_000,
    successThreshold: 2,
};
/** Sensible per-provider defaults. */
export const PROVIDER_CIRCUIT_DEFAULTS = {
    anthropic: { failureThreshold: 3, resetTimeoutMs: 60_000, successThreshold: 2 },
    openai: { failureThreshold: 3, resetTimeoutMs: 60_000, successThreshold: 2 },
    'openai-compatible': { failureThreshold: 5, resetTimeoutMs: 30_000, successThreshold: 2 },
    llamacpp: { failureThreshold: 10, resetTimeoutMs: 15_000, successThreshold: 3 },
    'llamacpp-embedded': { failureThreshold: 10, resetTimeoutMs: 15_000, successThreshold: 3 },
    transformers: { failureThreshold: 20, resetTimeoutMs: 5_000, successThreshold: 5 },
    webllm: { failureThreshold: 20, resetTimeoutMs: 5_000, successThreshold: 5 },
    mock: { failureThreshold: 100, resetTimeoutMs: 1_000, successThreshold: 10 },
};
const RoutingTelemetryEntrySchema = BaseLedgerEntrySchema.extend({
    task: z.string(),
    modelId: z.string(),
    latencyMs: z.number(),
    success: z.boolean(),
    demoted: z.boolean(),
    provider: z.string(),
    objective: z.unknown().optional(),
    chain: z.array(z.string()).optional(),
});
const ROUTING_LOG_FLUSH_INTERVAL_MS = 5000;
const lmTracer = getTracer('senars.lm');
export class ProviderRuntime {
    routing = null;
    lastDecision;
    /** Session-level demotions: a demoted model sinks to the back of the chain. */
    demotions = new Map();
    circuitBreakers = new Map();
    /** Out-of-band probe bookkeeping — not part of the breaker state machine. */
    #probes = new Map();
    /** Disposer owned by start/stopHealthProbes (providers.ts). */
    healthProbeInterval = null;
    fileSettings;
    /**
     * Runtime provider selection (lm.switch). Beats env/file at read time, so a
     * switch is instant and needs no registry rebuild — every configured provider
     * is already built (see `createSeNARSRegistry`), this only picks the default
     * chain. Cleared by `setActiveProvider(undefined)`.
     */
    activeProviderOverride;
    webllmRuntime;
    builtinProgressCallback;
    #routingLedger = null;
    routingLogEnabled = false;
    routingLogDir = 'logs';
    routingLogInterval = null;
    /** Install file/config-derived settings (env still wins at read time). */
    configureLM(settings) {
        this.fileSettings = settings;
    }
    /** Active settings, lazily resolved from env (+ anything installed via configureLM). */
    getLMSettings() {
        const base = resolveLMSettings(this.fileSettings);
        const override = this.activeProviderOverride;
        if (!override)
            return base;
        return {
            ...base,
            provider: override.provider,
            ...(override.model !== undefined ? { model: override.model } : {}),
        };
    }
    /** Select the runtime-active provider (and optional model). Undefined clears it. */
    setActiveProvider(provider, model) {
        this.activeProviderOverride = provider ? { provider, ...(model ? { model } : {}) } : undefined;
    }
    getActiveProvider() {
        return this.activeProviderOverride;
    }
    /** UI layer installs the WebLLM runtime at startup (browser only). */
    configureWebLLM(runtime) {
        this.webllmRuntime = runtime;
    }
    getWebLLMRuntime() {
        return this.webllmRuntime;
    }
    setBuiltinProgressCallback(cb) {
        this.builtinProgressCallback = cb;
    }
    getBuiltinProgressCallback() {
        return this.builtinProgressCallback;
    }
    setRouting(policy) {
        this.routing = policy;
    }
    getRouting() {
        return this.routing;
    }
    demoteModel(id, reason) {
        this.demotions.set(id, { reason, at: Date.now() });
    }
    resetDemotions() {
        this.demotions.clear();
    }
    getRoutingStatus() {
        return {
            policy: this.routing,
            demoted: [...this.demotions].map(([id, d]) => ({ id, ...d })),
            lastDecision: this.lastDecision,
        };
    }
    /** Effective circuit breaker config for a provider (settings > provider defaults > global defaults). */
    getEffectiveCircuitConfig(provider, settings) {
        const s = settings ?? this.getLMSettings();
        const fileCfg = s.circuitBreaker?.[provider];
        const providerDefaults = PROVIDER_CIRCUIT_DEFAULTS[provider] ?? {};
        return {
            ...DEFAULT_CIRCUIT_CONFIG,
            ...providerDefaults,
            ...fileCfg,
        };
    }
    /** Live breaker state for a provider, including out-of-band probe results. */
    breaker(provider) {
        const snap = this.#circuit(provider).snapshot();
        const probe = this.#probes.get(provider) ?? { lastProbe: null, probeResult: null };
        return { provider, ...snap, ...probe };
    }
    /** Record an out-of-band health probe; a success on an open circuit re-admits it. */
    recordProbe(provider, ok) {
        this.#probes.set(provider, { lastProbe: Date.now(), probeResult: ok });
        const breaker = this.#circuit(provider);
        if (ok && breaker.state === 'open')
            breaker.halfOpen('probe_recovered');
    }
    #circuit(provider, settings) {
        const cfg = this.getEffectiveCircuitConfig(provider, settings);
        const breaker = getOrInsert(this.circuitBreakers, provider, () => {
            const made = new CircuitBreaker(cfg);
            made.onTransition = (state, reason) => this.#transition(provider, state, reason);
            return made;
        });
        breaker.configure(cfg);
        return breaker;
    }
    getCircuitBreaker(provider) {
        return this.breaker(provider);
    }
    getAllCircuitBreakers() {
        return indexBy(this.circuitBreakers.keys(), (p) => p, (p) => this.breaker(p));
    }
    /** Close all breakers and clear failure counts (test/bench isolation between independent scenarios). */
    resetCircuitBreakers() {
        this.circuitBreakers.clear();
    }
    recordProviderCall(provider, success, settings) {
        this.#circuit(provider, settings).record(success);
    }
    canUseProvider(provider, settings) {
        return this.#circuit(provider, settings).canRequest();
    }
    #transition(provider, state, reason) {
        const details = { reason };
        const span = trace.getActiveSpan();
        if (span) {
            span.addEvent('circuit.breaker.state_change', {
                'lm.provider': provider,
                'circuit.state': state,
                ...details,
            });
        }
        lmTracer.startActiveSpan(`lm.circuit_breaker.${state}`, { kind: SpanKind.INTERNAL }, (span) => {
            span.setAttribute('lm.provider', provider);
            span.setAttribute('circuit.state', state);
            span.setAttribute('reason', reason);
            span.setStatus({ code: SpanStatusCode.OK });
            span.end();
        });
        recordCircuitBreakerState(provider, state);
    }
    enableRoutingTelemetry(options) {
        if (this.routingLogEnabled)
            return;
        this.routingLogEnabled = true;
        if (options?.logDir)
            this.routingLogDir = options.logDir;
        if (options?.flushIntervalMs && this.routingLogInterval) {
            this.routingLogInterval();
        }
        // Initialize ledger
        try {
            ensureDirSync(this.routingLogDir);
            this.#routingLedger = createLedger(this.routingLogDir, RoutingTelemetryEntrySchema);
        }
        catch {
            // Silently fail
        }
        this.routingLogInterval = periodic(() => this.flushRoutingLog(), options?.flushIntervalMs ?? ROUTING_LOG_FLUSH_INTERVAL_MS);
    }
    disableRoutingTelemetry() {
        if (!this.routingLogEnabled)
            return;
        this.routingLogEnabled = false;
        this.flushRoutingLog();
        if (this.routingLogInterval) {
            this.routingLogInterval();
            this.routingLogInterval = null;
        }
    }
    logRoutingDecision(entry) {
        if (!this.routingLogEnabled)
            return;
        const ledger = this.#routingLedger;
        if (ledger) {
            ledger.append({ ...entry, at: entry.ts });
        }
        // Flush immediately on circuit breaker events
        if (entry.demoted || !entry.success) {
            this.flushRoutingLog();
        }
    }
    getRoutingLogStatus() {
        const date = utcDate();
        const ledger = this.#routingLedger;
        return {
            enabled: this.routingLogEnabled,
            bufferSize: ledger?.getHotCacheSize() ?? 0,
            logPath: join(this.routingLogDir, `routing-${date}.jsonl`),
        };
    }
    flushRoutingLog() {
        // Ledger handles flushing automatically on append
        // This method is kept for API compatibility
    }
}
let defaultRuntime;
/** Process-wide default instance backing the module-level provider API. */
export const getProviderRuntime = () => (defaultRuntime ??= new ProviderRuntime());
const resolve = (args) => args.at(-1) instanceof ProviderRuntime
    ? args.pop()
    : getProviderRuntime();
/** Bind one `ProviderRuntime` method to the module-level provider API. */
export const delegate = (key) => ((...args) => {
    const rt = resolve(args);
    return rt[key].apply(rt, args);
});
/** Bind one `ProviderRuntime` field to the module-level provider API. */
export const readField = (key) => (rt) => (rt ?? getProviderRuntime())[key];
