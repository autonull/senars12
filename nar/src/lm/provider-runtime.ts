/**
 * Scoped provider runtime state (TODO20 X3) — routing policy, demotions,
 * circuit breakers, and routing telemetry log. The module-level default
 * instance (`getProviderRuntime`) preserves the historical global API; a
 * fresh instance gives a NAR/LMService its own routing + failure state so
 * parallel instances coexist in one process.
 */

import { join } from 'node:path';
import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import type { LMTask } from '@senars/util';
import { ensureDirSync, indexBy, periodic, utcDate } from '@senars/util';
import { BaseLedgerEntrySchema, createLedger, type Ledger } from '@senars/util/ledger';
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import { recordCircuitBreakerState } from '../metrics/index.js';
import { getTracer } from '../otel/index.js';
import {
  CircuitBreaker,
  type CircuitBreakerSettings,
  type CircuitSnapshot,
  type TransitionReason,
} from '../utils/circuit-breaker.js';
import {
  type CircuitState,
  type LMProviderName,
  type LMSettings,
  type LMSettingsInput,
  resolveLMSettings,
} from './env-config.js';

export type { CircuitState, CircuitBreakerSettings, LMProviderName };

/** Browser-side WebLLM runtime, injected by the UI layer (nar never imports browser code). */
export interface WebLLMRuntime {
  createModel: (modelKey: string, onProgress?: (progress: number) => void) => LanguageModel;
  models: Record<string, { id: string; label?: string }>;
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

export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerSettings = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  successThreshold: 2,
};

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
export const PROVIDER_CIRCUIT_DEFAULTS: Partial<
  Record<LMProviderName, Partial<CircuitBreakerSettings>>
> = {
  anthropic: { failureThreshold: 3, resetTimeoutMs: 60_000, successThreshold: 2 },
  openai: { failureThreshold: 3, resetTimeoutMs: 60_000, successThreshold: 2 },
  'openai-compatible': { failureThreshold: 5, resetTimeoutMs: 30_000, successThreshold: 2 },
  llamacpp: { failureThreshold: 10, resetTimeoutMs: 15_000, successThreshold: 3 },
  'llamacpp-embedded': { failureThreshold: 10, resetTimeoutMs: 15_000, successThreshold: 3 },
  transformers: { failureThreshold: 20, resetTimeoutMs: 5_000, successThreshold: 5 },
  webllm: { failureThreshold: 20, resetTimeoutMs: 5_000, successThreshold: 5 },
  mock: { failureThreshold: 100, resetTimeoutMs: 1_000, successThreshold: 10 },
};

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

type RoutingTelemetryLedgerEntry = z.infer<typeof RoutingTelemetryEntrySchema>;

const ROUTING_LOG_FLUSH_INTERVAL_MS = 5000;

const lmTracer = getTracer('senars.lm');

export class ProviderRuntime {
  routing: RoutingPolicy | null = null;
  lastDecision: RoutingDecision | undefined;
  /** Session-level demotions: a demoted model sinks to the back of the chain. */
  readonly demotions = new Map<string, { reason: string; at: number }>();
  readonly circuitBreakers = new Map<LMProviderName, CircuitBreaker>();
  /** Out-of-band probe bookkeeping — not part of the breaker state machine. */
  readonly #probes = new Map<
    LMProviderName,
    { lastProbe: number | null; probeResult: boolean | null }
  >();
  /** Disposer owned by start/stopHealthProbes (providers.ts). */
  healthProbeInterval: (() => void) | null = null;

  private fileSettings: LMSettingsInput | undefined;
  private webllmRuntime: WebLLMRuntime | undefined;
  private builtinProgressCallback: ((progress: number) => void) | undefined;
  readonly #routingLedger: Ledger<RoutingTelemetryLedgerEntry> | null = null;

  routingLogEnabled = false;
  routingLogDir = 'logs';
  routingLogInterval: (() => void) | null = null;

  /** Install file/config-derived settings (env still wins at read time). */
  configureLM(settings: LMSettingsInput): void {
    this.fileSettings = settings;
  }

  /** Active settings, lazily resolved from env (+ anything installed via configureLM). */
  getLMSettings(): LMSettings {
    return resolveLMSettings(this.fileSettings);
  }

  /** UI layer installs the WebLLM runtime at startup (browser only). */
  configureWebLLM(runtime: WebLLMRuntime | undefined): void {
    this.webllmRuntime = runtime;
  }

  getWebLLMRuntime(): WebLLMRuntime | undefined {
    return this.webllmRuntime;
  }

  setBuiltinProgressCallback(cb: ((progress: number) => void) | undefined): void {
    this.builtinProgressCallback = cb;
  }

  getBuiltinProgressCallback(): ((progress: number) => void) | undefined {
    return this.builtinProgressCallback;
  }

  setRouting(policy: RoutingPolicy | null): void {
    this.routing = policy;
  }

  getRouting(): RoutingPolicy | null {
    return this.routing;
  }

  demoteModel(id: string, reason: string): void {
    this.demotions.set(id, { reason, at: Date.now() });
  }

  resetDemotions(): void {
    this.demotions.clear();
  }

  getRoutingStatus(): {
    policy: RoutingPolicy | null;
    demoted: Array<{ id: string; reason: string; at: number }>;
    lastDecision: RoutingDecision | undefined;
  } {
    return {
      policy: this.routing,
      demoted: [...this.demotions].map(([id, d]) => ({ id, ...d })),
      lastDecision: this.lastDecision,
    };
  }

  /** Effective circuit breaker config for a provider (settings > provider defaults > global defaults). */
  getEffectiveCircuitConfig(
    provider: LMProviderName,
    settings?: LMSettings
  ): CircuitBreakerSettings {
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
  breaker(provider: LMProviderName): ProviderHealth {
    const snap = this.#circuit(provider).snapshot();
    const probe = this.#probes.get(provider) ?? { lastProbe: null, probeResult: null };
    return { provider, ...snap, ...probe };
  }

  /** Record an out-of-band health probe; a success on an open circuit re-admits it. */
  recordProbe(provider: LMProviderName, ok: boolean): void {
    this.#probes.set(provider, { lastProbe: Date.now(), probeResult: ok });
    const breaker = this.#circuit(provider);
    if (ok && breaker.state === 'open') breaker.halfOpen('probe_recovered');
  }

  #circuit(provider: LMProviderName, settings?: LMSettings): CircuitBreaker {
    const cfg = this.getEffectiveCircuitConfig(provider, settings);
    let breaker = this.circuitBreakers.get(provider);
    if (!breaker) {
      breaker = new CircuitBreaker(cfg);
      breaker.onTransition = (state, reason) => this.#transition(provider, state, reason);
      this.circuitBreakers.set(provider, breaker);
    } else {
      breaker.configure(cfg);
    }
    return breaker;
  }

  getCircuitBreaker(provider: LMProviderName): ProviderHealth {
    return this.breaker(provider);
  }

  getAllCircuitBreakers(): Map<LMProviderName, ProviderHealth> {
    return indexBy(this.circuitBreakers.keys(), (p) => p, (p) => this.breaker(p));
  }

  /** Close all breakers and clear failure counts (test/bench isolation between independent scenarios). */
  resetCircuitBreakers(): void {
    this.circuitBreakers.clear();
  }

  recordProviderCall(provider: LMProviderName, success: boolean, settings?: LMSettings): void {
    this.#circuit(provider, settings).record(success);
  }

  canUseProvider(provider: LMProviderName, settings?: LMSettings): boolean {
    return this.#circuit(provider, settings).canRequest();
  }

  #transition(provider: LMProviderName, state: CircuitState, reason: TransitionReason): void {
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

  enableRoutingTelemetry(options?: { logDir?: string; flushIntervalMs?: number }): void {
    if (this.routingLogEnabled) return;
    this.routingLogEnabled = true;
    if (options?.logDir) this.routingLogDir = options.logDir;
    if (options?.flushIntervalMs && this.routingLogInterval) {
      this.routingLogInterval();
    }
    // Initialize ledger
    try {
      ensureDirSync(this.routingLogDir);
      (this as any).#routingLedger = createLedger<RoutingTelemetryLedgerEntry>(
        this.routingLogDir,
        RoutingTelemetryEntrySchema
      );
    } catch {
      // Silently fail
    }
    this.routingLogInterval = periodic(
      () => this.flushRoutingLog(),
      options?.flushIntervalMs ?? ROUTING_LOG_FLUSH_INTERVAL_MS
    );
  }

  disableRoutingTelemetry(): void {
    if (!this.routingLogEnabled) return;
    this.routingLogEnabled = false;
    this.flushRoutingLog();
    if (this.routingLogInterval) {
      this.routingLogInterval();
      this.routingLogInterval = null;
    }
  }

  logRoutingDecision(entry: RoutingTelemetryEntry): void {
    if (!this.routingLogEnabled) return;
    const ledger = (this as any).#routingLedger as Ledger<RoutingTelemetryLedgerEntry> | null;
    if (ledger) {
      ledger.append({ ...entry, at: entry.ts } as RoutingTelemetryLedgerEntry);
    }
    // Flush immediately on circuit breaker events
    if (entry.demoted || !entry.success) {
      this.flushRoutingLog();
    }
  }

  getRoutingLogStatus(): { enabled: boolean; bufferSize: number; logPath: string } {
    const date = utcDate();
    const ledger = (this as any).#routingLedger as Ledger<RoutingTelemetryLedgerEntry> | null;
    return {
      enabled: this.routingLogEnabled,
      bufferSize: ledger?.getHotCacheSize() ?? 0,
      logPath: join(this.routingLogDir, `routing-${date}.jsonl`),
    };
  }

  private flushRoutingLog(): void {
    // Ledger handles flushing automatically on append
    // This method is kept for API compatibility
  }
}

let defaultRuntime: ProviderRuntime | undefined;

/** Process-wide default instance backing the module-level provider API. */
export const getProviderRuntime = (): ProviderRuntime => (defaultRuntime ??= new ProviderRuntime());
