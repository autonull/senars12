/**
 * Scoped provider runtime state (TODO20 X3) — routing policy, demotions,
 * circuit breakers, and routing telemetry log. The module-level default
 * instance (`getProviderRuntime`) preserves the historical global API; a
 * fresh instance gives a NAR/LMService its own routing + failure state so
 * parallel instances coexist in one process.
 */
import { Ledger, createLedger, BaseLedgerEntrySchema } from '@senars/io';
import { z } from 'zod';
import { join } from 'node:path';
import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import type { LMTask } from '@senars/util';
import type { LanguageModel } from 'ai';
import { recordCircuitBreakerState } from '../metrics/index.js';
import { getTracer } from '../otel/index.js';
import {
  type CircuitBreakerConfig,
  type LMProviderName,
  type LMSettings,
  type LMSettingsInput,
  resolveLMSettings,
} from './env-config.js';

export type { CircuitBreakerConfig, LMProviderName };

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

export type CircuitState = 'closed' | 'open' | 'half-open';

export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
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
  Record<LMProviderName, Partial<CircuitBreakerConfig>>
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

export interface ProviderHealth {
  provider: LMProviderName;
  state: CircuitState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailure: number | null;
  lastSuccess: number | null;
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
  readonly circuitBreakers = new Map<LMProviderName, ProviderHealth>();
  /** Interval handle owned by start/stopHealthProbes (providers.ts). */
  healthProbeInterval: ReturnType<typeof setInterval> | null = null;

  private fileSettings: LMSettingsInput | undefined;
  private webllmRuntime: WebLLMRuntime | undefined;
  private builtinProgressCallback: ((progress: number) => void) | undefined;
  readonly #routingLedger: Ledger<RoutingTelemetryLedgerEntry> | null = null;

  routingLogEnabled = false;
  routingLogDir = 'logs';
  routingLogInterval: ReturnType<typeof setInterval> | null = null;

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
  getEffectiveCircuitConfig(provider: LMProviderName, settings?: LMSettings): CircuitBreakerConfig {
    const s = settings ?? this.getLMSettings();
    const fileCfg = s.circuitBreaker?.[provider];
    const providerDefaults = PROVIDER_CIRCUIT_DEFAULTS[provider] ?? {};
    return {
      ...DEFAULT_CIRCUIT_CONFIG,
      ...providerDefaults,
      ...fileCfg,
    };
  }

  /** Live breaker state (probe loops mutate `lastProbe`/`probeResult` directly). */
  breaker(provider: LMProviderName): ProviderHealth {
    let b = this.circuitBreakers.get(provider);
    if (!b) {
      b = {
        provider,
        state: 'closed',
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        lastFailure: null,
        lastSuccess: null,
        lastProbe: null,
        probeResult: null,
      };
      this.circuitBreakers.set(provider, b);
    }
    return b;
  }

  getCircuitBreaker(provider: LMProviderName): ProviderHealth {
    return { ...this.breaker(provider) };
  }

  getAllCircuitBreakers(): Map<LMProviderName, ProviderHealth> {
    return new Map(this.circuitBreakers);
  }

  /** Close all breakers and clear failure counts (test/bench isolation between independent scenarios). */
  resetCircuitBreakers(): void {
    this.circuitBreakers.clear();
  }

  recordProviderCall(provider: LMProviderName, success: boolean, settings?: LMSettings): void {
    const cfg = this.getEffectiveCircuitConfig(provider, settings);
    const b = this.breaker(provider);
    const now = Date.now();

    if (success) {
      b.consecutiveSuccesses++;
      b.consecutiveFailures = 0;
      b.lastSuccess = now;
      if (b.state === 'half-open' && b.consecutiveSuccesses >= cfg.successThreshold) {
        b.state = 'closed';
        b.consecutiveFailures = 0;
        b.consecutiveSuccesses = 0;
        this.#transition(provider, 'closed', 'success_threshold_met');
      }
    } else {
      b.consecutiveFailures++;
      b.consecutiveSuccesses = 0;
      b.lastFailure = now;
      if (b.state === 'closed' && b.consecutiveFailures >= cfg.failureThreshold) {
        this.#trip(provider);
      } else if (b.state === 'half-open') {
        this.#trip(provider);
      }
    }
  }

  canUseProvider(provider: LMProviderName, settings?: LMSettings): boolean {
    const cfg = this.getEffectiveCircuitConfig(provider, settings);
    const b = this.breaker(provider);
    if (b.state === 'closed') return true;
    if (b.state === 'open') {
      if (b.lastFailure && Date.now() - b.lastFailure >= cfg.resetTimeoutMs) {
        b.state = 'half-open';
        b.consecutiveSuccesses = 0;
        this.#transition(provider, 'half-open', 'reset_timeout_elapsed');
        return true;
      }
      return false;
    }
    // half-open: allow one call through
    return true;
  }

  #trip(provider: LMProviderName): void {
    const b = this.breaker(provider);
    b.state = 'open';
    b.lastFailure = Date.now();
    this.#transition(provider, 'open', 'failure_threshold_exceeded');
  }

  #transition(provider: LMProviderName, state: CircuitState, reason: string): void {
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
      clearInterval(this.routingLogInterval);
    }
    // Initialize ledger
    try {
      const { mkdirSync } = require('node:fs');
      mkdirSync(this.routingLogDir, { recursive: true });
      (this as any).#routingLedger = createLedger<RoutingTelemetryLedgerEntry>(
        this.routingLogDir,
        RoutingTelemetryEntrySchema,
        { rollover: { daily: true, maxEntriesPerFile: 10_000, retentionDays: 30 } }
      );
    } catch {
      // Silently fail
    }
    this.routingLogInterval = setInterval(
      () => this.flushRoutingLog(),
      options?.flushIntervalMs ?? ROUTING_LOG_FLUSH_INTERVAL_MS
    );
    this.routingLogInterval.unref?.();
  }

  disableRoutingTelemetry(): void {
    if (!this.routingLogEnabled) return;
    this.routingLogEnabled = false;
    this.flushRoutingLog();
    if (this.routingLogInterval) {
      clearInterval(this.routingLogInterval);
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
    const date = new Date().toISOString().split('T')[0];
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
