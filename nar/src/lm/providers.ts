import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { transformersJS } from '@browser-ai/transformers-js';
import type { LMExecutionStats, LMTask } from '@senars/util';
import { createProviderRegistry, customProvider, type LanguageModel } from 'ai';
import {
  builtinModels,
  defaultModelFor,
  type LMSettings,
  type LMSettingsInput,
  resolveLMSettings,
} from './env-config.js';
import { createMockLanguageModel } from './lm-service.js';
import { createWebLLMModel, webllmModels } from '@senars/ui-webllm';
import { trace, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { getTracer } from '../otel/index.js';
import { recordCircuitBreakerState, recordLmProbe } from '../metrics/index.js';

export type { LMTask } from '@senars/util';
export type { LMSettings } from './env-config.js';

const OLLAMA_HOST_DEFAULT = 'http://localhost:11434';
const OLLAMA_FAST_DEFAULT = 'llama3.2:3b';
const OLLAMA_COMPACT_DEFAULT = 'phi3:3.8b';

export type LMProviderName =
  | 'transformers'
  | 'ollama'
  | 'anthropic'
  | 'openai'
  | 'openai-compatible'
  | 'webllm'
  | 'mock';

export { webllmModels };

let activeFileSettings: LMSettingsInput | undefined;

/** Install file/config-derived settings (env still wins at read time). */
export const configureLM = (settings: LMSettingsInput): void => {
  activeFileSettings = settings;
};

/** Active settings, lazily resolved from env (+ anything installed via configureLM). */
export const getLMSettings = (): LMSettings => resolveLMSettings(activeFileSettings);

export const getLmProvider = (): LMProviderName => getLMSettings().provider;

/** WebGPU auto-detection: prefer webgpu when available, else cpu. */
export const detectDevice = (): 'webgpu' | 'cpu' =>
  typeof navigator !== 'undefined' && 'gpu' in navigator ? 'webgpu' : 'cpu';

/** Progress callback type for model download/initialization. */
export type ModelDownloadProgressCallback = (progress: number) => void;

const localModel = (
  model: string,
  settings: LMSettings,
  onProgress?: ModelDownloadProgressCallback
): LanguageModel =>
  transformersJS(model, {
    device: detectDevice(),
    dtype: settings.quantized ? 'q4' : 'fp32',
    ...(settings.cacheDir ? { cacheDir: settings.cacheDir } : {}),
    ...(onProgress ? { initProgressCallback: onProgress } : {}),
  } as Parameters<typeof transformersJS>[1]);

const mockModel = (): LanguageModel => createMockLanguageModel() as unknown as LanguageModel;

const cloudApiKey = (settings: LMSettings): string | undefined => {
  const viaEnvName = settings.apiKeyEnv ? process.env[settings.apiKeyEnv] : undefined;
  return (
    viaEnvName ??
    process.env.LM_API_KEY ??
    process.env.ANTHROPIC_API_KEY ??
    process.env.OPENAI_API_KEY
  );
};

let builtinProgressCallback: ModelDownloadProgressCallback | undefined;

export const setBuiltinProgressCallback = (cb: ModelDownloadProgressCallback | undefined): void => {
  builtinProgressCallback = cb;
};

export function createSeNARSRegistry(settings?: LMSettings) {
  const s = settings ?? getLMSettings();
  const {
    provider,
    model: modelOverride,
    fastModel,
    structuredModel,
    compactModel,
    baseUrl,
    ollamaHost,
  } = s;

  const hasCloudKey = Boolean(cloudApiKey(s));
  const useCloud =
    (provider === 'anthropic' || provider === 'openai' || provider === 'openai-compatible') &&
    hasCloudKey;
  const useLocal =
    provider === 'ollama' ||
    provider === 'anthropic' ||
    provider === 'openai' ||
    provider === 'openai-compatible';
  const useWebLLM = provider === 'webllm' && typeof navigator !== 'undefined' && 'gpu' in navigator;

  const ollama = createOpenAICompatible({
    name: 'ollama',
    apiKey: 'ollama',
    baseURL: `${(ollamaHost ?? OLLAMA_HOST_DEFAULT).replace(/\/v1\/?$/, '')}/v1`,
  });
  const cloud = createOpenAICompatible({
    name: 'cloud',
    apiKey: cloudApiKey(s) ?? '',
    baseURL:
      baseUrl ??
      (provider === 'anthropic' ? 'https://api.anthropic.com/v1' : 'https://api.openai.com/v1'),
  });
  const frontierId = modelOverride ?? defaultModelFor(provider);
  const builtinCompact = compactModel ?? builtinModels.compact;
  const offlineTier = resolveOfflineTier(s);

  const webllmQuality = useWebLLM ? createWebLLMModel('llama-3.2-3b-instruct') : mockModel();
  const webllmFast = useWebLLM ? createWebLLMModel('phi-3.5-mini-instruct') : mockModel();

  return createProviderRegistry({
    cloud: customProvider({
      languageModels: {
        quality: useCloud ? cloud(frontierId) : mockModel(),
        fast: useCloud ? cloud(fastModel ?? frontierId) : mockModel(),
        structured: useCloud ? cloud(structuredModel ?? frontierId) : mockModel(),
        compact: useCloud ? cloud(compactModel ?? frontierId) : mockModel(),
      },
      fallbackProvider: useCloud ? cloud : undefined,
    }),
    local: customProvider({
      languageModels: {
        quality: useLocal ? ollama(modelOverride ?? defaultModelFor('ollama')) : mockModel(),
        fast: useLocal ? ollama(fastModel ?? OLLAMA_FAST_DEFAULT) : mockModel(),
        compact: useLocal ? ollama(compactModel ?? OLLAMA_COMPACT_DEFAULT) : mockModel(),
      },
      fallbackProvider: useLocal ? ollama : undefined,
    }),
    webllm: customProvider({
      languageModels: {
        quality: webllmQuality,
        fast: webllmFast,
        structured: webllmQuality,
        compact: webllmFast,
      },
      fallbackProvider: useWebLLM ? undefined : undefined,
    }),
    builtin: customProvider({
      languageModels: {
        quality: localModel(offlineTier ?? modelOverride ?? builtinModels.quality, s, builtinProgressCallback),
        fast: localModel(builtinCompact, s, builtinProgressCallback),
        structured: localModel(builtinCompact, s, builtinProgressCallback),
        compact: localModel(builtinCompact, s, builtinProgressCallback),
        mock: mockModel(),
      },
    }),
  });
}

export type SeNARSRegistry = ReturnType<typeof createSeNARSRegistry>;
export type SeNARSModelId = Parameters<SeNARSRegistry['languageModel']>[0];

/** Per-model capability metadata used by routing decisions. */
export interface ModelCapability {
  contextTokens: number;
  supportsTools: boolean;
  supportsJson: boolean;
  costPerMTok: number;
  latencyClass: 'fast' | 'medium' | 'slow';
  local: boolean;
}

const cloudFrontierCap = {
  contextTokens: 200_000,
  supportsTools: true,
  supportsJson: true,
  costPerMTok: 3,
  latencyClass: 'medium',
  local: false,
} as const;
const localCap = {
  contextTokens: 32_768,
  supportsTools: false,
  supportsJson: true,
  costPerMTok: 0,
  latencyClass: 'fast',
  local: true,
} as const;

const webllmCap = {
  contextTokens: 8192,
  supportsTools: false,
  supportsJson: true,
  costPerMTok: 0,
  latencyClass: 'fast' as const,
  local: true,
} as const;

export const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  'cloud:quality': { ...cloudFrontierCap, latencyClass: 'medium' },
  'cloud:fast': { ...cloudFrontierCap, costPerMTok: 0.15, latencyClass: 'fast' },
  'cloud:structured': { ...cloudFrontierCap, latencyClass: 'medium' },
  'cloud:compact': { ...cloudFrontierCap, costPerMTok: 0.15, latencyClass: 'fast' },
  'local:quality': { ...localCap, latencyClass: 'medium' },
  'local:fast': { ...localCap, latencyClass: 'fast' },
  'local:compact': { ...localCap, latencyClass: 'fast' },
  'builtin:quality': { ...localCap, latencyClass: 'slow' },
  'builtin:fast': { ...localCap, latencyClass: 'fast' },
  'builtin:compact': { ...localCap, latencyClass: 'fast', contextTokens: 8_192 },
  'builtin:mock': { ...localCap, latencyClass: 'fast', contextTokens: 1_024 },
  'webllm:quality': { ...webllmCap, latencyClass: 'medium' },
  'webllm:fast': { ...webllmCap, latencyClass: 'fast' },
};

export const getModelCapability = (id: string): ModelCapability | undefined =>
  MODEL_CAPABILITIES[id];

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

export type QualityObjective = 'balanced' | 'high' | 'max';

export interface RoutingObjective {
  quality?: QualityObjective;
  maxLatencyMs?: number;
  offlineOnly?: boolean;
}

let routing: RoutingPolicy | null = null;

export const setRouting = (policy: RoutingPolicy | null): void => {
  routing = policy;
};

export const getRouting = (): RoutingPolicy | null => routing;

/** Session-level demotions: a demoted model sinks to the back of the chain. */
const demotions = new Map<string, { reason: string; at: number }>();

export const demoteModel = (id: string, reason: string): void => {
  demotions.set(id, { reason, at: Date.now() });
};
export const getDemotions = (): Map<string, { reason: string; at: number }> => demotions;
export const resetDemotions = (): void => demotions.clear();

export interface RoutingDecision {
  task: LMTask;
  modelId: string;
  reason: 'primary' | 'failover';
}

let lastDecision: RoutingDecision | undefined;

export const getLastRoutingDecision = (): RoutingDecision | undefined => lastDecision;

export const getRoutingStatus = (): {
  policy: RoutingPolicy | null;
  demoted: Array<{ id: string; reason: string; at: number }>;
  lastDecision: RoutingDecision | undefined;
} => ({
  policy: routing,
  demoted: [...demotions].map(([id, d]) => ({ id, ...d })),
  lastDecision,
});

const latencyClassOf = (id: string): 'fast' | 'medium' | 'slow' => {
  const cap = MODEL_CAPABILITIES[id];
  return cap?.latencyClass ?? (id.startsWith('builtin:') ? 'slow' : 'medium');
};

const CHAINS: Record<LMProviderName, Record<LMTask, SeNARSModelId[]>> = {
  transformers: {
    quality: ['builtin:quality'],
    fast: ['builtin:fast'],
    structured: ['builtin:structured'],
  },
  mock: {
    quality: ['builtin:mock'],
    fast: ['builtin:mock'],
    structured: ['builtin:mock'],
  },
  ollama: {
    quality: ['local:quality', 'builtin:quality', 'builtin:compact', 'builtin:mock'],
    fast: ['local:fast', 'builtin:compact', 'builtin:mock'],
    structured: ['local:quality', 'builtin:compact', 'builtin:mock'],
  },
  anthropic: {
    quality: ['cloud:quality', 'local:quality', 'builtin:quality', 'builtin:mock'],
    fast: ['cloud:fast', 'local:fast', 'builtin:compact', 'builtin:mock'],
    structured: ['cloud:structured', 'local:quality', 'builtin:compact', 'builtin:mock'],
  },
  openai: {
    quality: ['cloud:quality', 'local:quality', 'builtin:quality', 'builtin:mock'],
    fast: ['cloud:fast', 'local:fast', 'builtin:compact', 'builtin:mock'],
    structured: ['cloud:structured', 'local:quality', 'builtin:compact', 'builtin:mock'],
  },
  'openai-compatible': {
    quality: ['cloud:quality', 'local:quality', 'builtin:quality', 'builtin:mock'],
    fast: ['cloud:fast', 'local:fast', 'builtin:compact', 'builtin:mock'],
    structured: ['cloud:structured', 'local:quality', 'builtin:compact', 'builtin:mock'],
  },
  webllm: {
    quality: ['webllm:quality', 'builtin:quality', 'builtin:compact', 'builtin:mock'],
    fast: ['webllm:fast', 'builtin:compact', 'builtin:mock'],
    structured: ['webllm:quality', 'builtin:compact', 'builtin:mock'],
  },
};

export function getModelChain(provider: LMProviderName, task: LMTask): SeNARSModelId[] {
  const c = routing?.candidates;
  if (c?.length) {
    const obj = routing?.objectives?.[task];
    const offlineOnly = obj?.offlineOnly ?? routing?.offlineOnly;
    const maxLatencyMs = obj?.maxLatencyMs ?? routing?.maxLatencyMs;
    // demoted candidates sink to the back of the chain (session-level)
    const ordered = [...c].sort((a, b) => Number(demotions.has(a)) - Number(demotions.has(b)));
    const seen = new Set<string>();
    const chain: string[] = [];
    for (const id of [...ordered, 'builtin:compact', 'builtin:mock']) {
      if (offlineOnly && !id.startsWith('builtin:')) continue;
      if (maxLatencyMs !== undefined && latencyClassOf(id) === 'slow') continue;
      if (seen.has(id)) continue;
      seen.add(id);
      chain.push(id);
    }
    return chain as SeNARSModelId[];
  }
  return CHAINS[provider][task];
}

export function getModelForTask(
  registry: SeNARSRegistry,
  task: LMTask,
  settings?: LMSettings,
  stats?: Record<string, LMExecutionStats>
): LanguageModel {
  const chain = getModelChain(settings?.provider ?? getLmProvider(), task);
  // R4/R5: success-rate-aware reordering within the resolved chain (failsafe rungs stay
  // guaranteed by pickModel's deterministic tie-breaking and the appended ladder).
  const ordered = (stats ? pickModel(chain, {}, stats).map((c) => c.id) : chain) as SeNARSModelId[];
  for (const [i, id] of ordered.entries()) {
    try {
      const model = registry.languageModel(id);
      lastDecision = { task, modelId: id, reason: i === 0 ? 'primary' : 'failover' };
      return model;
    } catch {}
  }
  throw new Error(`No model available for task: ${task}`);
}

export function getQualityModel(registry: SeNARSRegistry): LanguageModel {
  return getModelForTask(registry, 'quality');
}

export const hasCloudCredentials = (settings?: LMSettings): boolean =>
  Boolean(cloudApiKey(settings ?? getLMSettings()));

export async function probeOllama(host?: string): Promise<boolean> {
  const base = (host ?? getLMSettings().ollamaHost ?? 'http://localhost:11434').replace(
    /\/v1\/?$/,
    ''
  );
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1500);
    const res = await fetch(`${base}/api/tags`, { signal: ctl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

export async function resolveActiveProvider(): Promise<LMProviderName> {
  const configured = getLmProvider();
  if (configured === 'mock') return 'mock';
  if (configured === 'webllm') {
    return (typeof navigator !== 'undefined' && 'gpu' in navigator) ? 'webllm' : 'transformers';
  }
  if (configured === 'transformers') {
    if (hasCloudCredentials()) return 'openai-compatible';
    return (await probeOllama()) ? 'ollama' : 'transformers';
  }
  if (configured === 'ollama') return (await probeOllama()) ? 'ollama' : 'transformers';
  return hasCloudCredentials() ? configured : (await probeOllama()) ? 'ollama' : 'transformers';
}

// ---- Health probe & circuit breaker for cloud providers ----

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  /** Failures before opening the circuit. */
  failureThreshold: number;
  /** Time in ms before attempting half-open. */
  resetTimeoutMs: number;
  /** Successful calls in half-open before closing. */
  successThreshold: number;
}

const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  successThreshold: 2,
};

/** Sensible per-provider defaults. */
const PROVIDER_CIRCUIT_DEFAULTS: Partial<Record<LMProviderName, Partial<CircuitBreakerConfig>>> = {
  anthropic: { failureThreshold: 3, resetTimeoutMs: 60_000, successThreshold: 2 },
  openai: { failureThreshold: 3, resetTimeoutMs: 60_000, successThreshold: 2 },
  'openai-compatible': { failureThreshold: 5, resetTimeoutMs: 30_000, successThreshold: 2 },
  ollama: { failureThreshold: 10, resetTimeoutMs: 15_000, successThreshold: 3 },
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

const circuitBreakers = new Map<LMProviderName, ProviderHealth>();

function getBreaker(provider: LMProviderName): ProviderHealth {
  let b = circuitBreakers.get(provider);
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
    circuitBreakers.set(provider, b);
  }
  return b;
}

export function getCircuitBreaker(provider: LMProviderName): ProviderHealth {
  return { ...getBreaker(provider) };
}

export function getAllCircuitBreakers(): Map<LMProviderName, ProviderHealth> {
  return new Map(circuitBreakers);
}

/** Get effective circuit breaker config for a provider (settings > provider defaults > global defaults). */
export function getEffectiveCircuitConfig(
  provider: LMProviderName,
  settings?: LMSettings
): CircuitBreakerConfig {
  const s = settings ?? getLMSettings();
  const fileCfg = s.circuitBreaker?.[provider];
  const providerDefaults = PROVIDER_CIRCUIT_DEFAULTS[provider] ?? {};
  return {
    ...DEFAULT_CIRCUIT_CONFIG,
    ...providerDefaults,
    ...fileCfg,
  };
}

const lmTracer = getTracer('senars12.lm');

function emitCircuitBreakerEvent(provider: LMProviderName, state: CircuitState, details: Record<string, unknown> = {}): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent('circuit.breaker.state_change', {
      'lm.provider': provider,
      'circuit.state': state,
      ...details,
    });
  }
  // Also create a dedicated span for the state change
  lmTracer.startActiveSpan(
    `lm.circuit_breaker.${state}`,
    { kind: SpanKind.INTERNAL },
    (span) => {
      span.setAttribute('lm.provider', provider);
      span.setAttribute('circuit.state', state);
      Object.entries(details).forEach(([key, value]) => {
        if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
          span.setAttribute(key, value);
        }
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    }
  );
  // Record Prometheus metric
  recordCircuitBreakerState(provider, state);
}

function tripBreaker(provider: LMProviderName): void {
  const b = getBreaker(provider);
  b.state = 'open';
  b.lastFailure = Date.now();
  emitCircuitBreakerEvent(provider, 'open', { reason: 'failure_threshold_exceeded' });
}

function halfOpenBreaker(provider: LMProviderName): void {
  const b = getBreaker(provider);
  b.state = 'half-open';
  b.consecutiveSuccesses = 0;
  emitCircuitBreakerEvent(provider, 'half-open', { reason: 'reset_timeout_elapsed' });
}

function closeBreaker(provider: LMProviderName): void {
  const b = getBreaker(provider);
  b.state = 'closed';
  b.consecutiveFailures = 0;
  b.consecutiveSuccesses = 0;
  emitCircuitBreakerEvent(provider, 'closed', { reason: 'success_threshold_met' });
}

export function recordProviderCall(
  provider: LMProviderName,
  success: boolean,
  settings?: LMSettings
): void {
  const cfg = getEffectiveCircuitConfig(provider, settings);
  const b = getBreaker(provider);
  const now = Date.now();

  if (success) {
    b.consecutiveSuccesses++;
    b.consecutiveFailures = 0;
    b.lastSuccess = now;
    if (b.state === 'half-open' && b.consecutiveSuccesses >= cfg.successThreshold) {
      closeBreaker(provider);
    }
  } else {
    b.consecutiveFailures++;
    b.consecutiveSuccesses = 0;
    b.lastFailure = now;
    if (b.state === 'closed' && b.consecutiveFailures >= cfg.failureThreshold) {
      tripBreaker(provider);
    } else if (b.state === 'half-open') {
      tripBreaker(provider);
    }
  }
}

export function canUseProvider(provider: LMProviderName, settings?: LMSettings): boolean {
  const cfg = getEffectiveCircuitConfig(provider, settings);
  const b = getBreaker(provider);
  if (b.state === 'closed') return true;
  if (b.state === 'open') {
    if (b.lastFailure && Date.now() - b.lastFailure >= cfg.resetTimeoutMs) {
      halfOpenBreaker(provider);
      return true;
    }
    return false;
  }
  // half-open: allow one call through
  return true;
}

export async function probeCloudProvider(settings?: LMSettings): Promise<boolean> {
  const s = settings ?? getLMSettings();
  const key = cloudApiKey(s);
  if (!key) return false;

  const baseUrl = s.baseUrl ?? (s.provider === 'anthropic' ? 'https://api.anthropic.com/v1' : 'https://api.openai.com/v1');
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000);
    const res = await fetch(`${baseUrl}/models`, {
      signal: ctl.signal,
      headers: s.provider === 'anthropic'
        ? { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
        : { Authorization: `Bearer ${key}` },
    });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

let healthProbeInterval: ReturnType<typeof setInterval> | null = null;

export function startHealthProbes(intervalMs = 60_000, settings?: LMSettings): void {
  if (healthProbeInterval) return;
  healthProbeInterval = setInterval(async () => {
    const providers: LMProviderName[] = ['anthropic', 'openai', 'openai-compatible', 'ollama', 'webllm'];
    for (const p of providers) {
      if (!canUseProvider(p, settings)) continue;
      let ok = false;
      if (p === 'ollama') {
        ok = await probeOllama(settings?.ollamaHost);
      } else if (['anthropic', 'openai', 'openai-compatible'].includes(p)) {
        ok = await probeCloudProvider(settings);
      } else if (p === 'webllm') {
        ok = typeof navigator !== 'undefined' && 'gpu' in navigator;
      }
      const b = getBreaker(p);
      b.lastProbe = Date.now();
      b.probeResult = ok;
      // Record Prometheus metric
      recordLmProbe(p, ok);
      if (ok && b.state === 'open') {
        halfOpenBreaker(p);
      } else if (!ok && b.state !== 'open') {
        recordProviderCall(p, false, settings);
      }
    }
  }, intervalMs);
  healthProbeInterval.unref?.();
}

export function stopHealthProbes(): void {
  if (healthProbeInterval) {
    clearInterval(healthProbeInterval);
    healthProbeInterval = null;
  }
}

// ---- R4: deterministic candidate scoring ----

const OBJECTIVE_WEIGHTS: Record<
  QualityObjective,
  { quality: number; cost: number; latency: number }
> = {
  balanced: { quality: 0.4, cost: 0.3, latency: 0.3 },
  high: { quality: 0.55, cost: 0.15, latency: 0.3 },
  max: { quality: 0.7, cost: 0.1, latency: 0.2 },
};

/** Capability-based quality estimate in [0,1]: context, tool support, frontier cost proxy. */
const qualityTier = (cap?: ModelCapability): number =>
  cap
    ? (cap.contextTokens / 200_000) * 0.6 +
      (cap.supportsTools ? 0.2 : 0) +
      (cap.costPerMTok > 0 ? 0.2 : 0)
    : 0.3;

const LATENCY_PENALTY: Record<ModelCapability['latencyClass'], number> = {
  fast: 0,
  medium: 0.5,
  slow: 1,
};

/** Minimum `maxLatencyMs` a latency class satisfies; a class fails when maxLatencyMs is below it. */
const LATENCY_FLOOR: Record<ModelCapability['latencyClass'], number> = {
  fast: 2_000,
  medium: 5_000,
  slow: 30_000,
};

export interface CandidateScore {
  id: string;
  score: number;
  qualifies: boolean;
  breakdown: { quality: number; cost: number; latency: number; successRate: number };
}

/** Ranks candidate model ids against an objective; hard constraints (offlineOnly, maxLatencyMs) filter first. */
export function pickModel(
  candidates: readonly string[],
  objective: RoutingObjective = {},
  stats?: Record<string, LMExecutionStats>
): CandidateScore[] {
  const w = OBJECTIVE_WEIGHTS[objective.quality ?? 'balanced'];
  return candidates
    .map((id) => {
      const cap = MODEL_CAPABILITIES[id];
      const q = qualityTier(cap);
      const cost = cap ? Math.min(1, cap.costPerMTok / 3) : 0;
      const lat = cap ? LATENCY_PENALTY[cap.latencyClass] : 0.5;
      const successRate = stats?.[id]?.successRate ?? 1;
      const qualifies =
        !(objective.offlineOnly && !id.startsWith('builtin:')) &&
        !(
          objective.maxLatencyMs !== undefined &&
          cap !== undefined &&
          objective.maxLatencyMs < LATENCY_FLOOR[cap.latencyClass]
        );
      const objectiveScore = w.quality * q + w.cost * (1 - cost) + w.latency * (1 - lat);
      return {
        id,
        qualifies,
        breakdown: { quality: q, cost, latency: lat, successRate },
        // reliability scales the objective score: a 0%-success model ranks low regardless
        score: objectiveScore * (0.3 + 0.7 * successRate),
      };
    })
    .sort((a, b) => Number(b.qualifies) - Number(a.qualifies) || b.score - a.score);
}

export const pickBestModel = (
  candidates: readonly string[],
  objective?: RoutingObjective,
  stats?: Record<string, LMExecutionStats>
): string | undefined => pickModel(candidates, objective, stats).find((c) => c.qualifies)?.id;

// ---- R7: self-upgrading offline ladder ----

const OFFLINE_CACHE_DIR_DEFAULT = '.cache/transformers';

const cacheDirNameFor = (model: string): string => `models--${model.replaceAll('/', '--')}`;

/** Largest ladder rung already cached under cacheDir (ladder ordered smallest → most capable). */
export const resolveOfflineModel = (
  ladder: readonly string[],
  cacheDir: string
): string | undefined =>
  ladder.filter((rung) => existsSync(join(cacheDir, cacheDirNameFor(rung)))).at(-1);

/** LM_LOCAL_MODEL wins, else the largest cached offline-ladder rung, else undefined (config default). */
export const resolveOfflineTier = (settings?: LMSettings): string | undefined => {
  const envModel = process.env.LM_LOCAL_MODEL;
  if (envModel) return envModel;
  const ladder = getRouting()?.offlineLadder;
  if (!ladder?.length) return undefined;
  return resolveOfflineModel(ladder, settings?.cacheDir ?? OFFLINE_CACHE_DIR_DEFAULT);
};

// ---- Routing telemetry (1B) ----

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

let routingLogEnabled = false;
let routingLogDir = 'logs';
let routingLogInterval: ReturnType<typeof setInterval> | null = null;
const routingLogBuffer: RoutingTelemetryEntry[] = [];
const ROUTING_LOG_FLUSH_INTERVAL_MS = 5000;

function getRoutingLogPath(): string {
  const date = new Date().toISOString().split('T')[0];
  return join(routingLogDir, `routing-${date}.jsonl`);
}

function flushRoutingLog(): void {
  if (routingLogBuffer.length === 0) return;
  try {
    mkdirSync(routingLogDir, { recursive: true });
    const path = getRoutingLogPath();
    const lines = routingLogBuffer.splice(0).map((e) => JSON.stringify(e)).join('\n') + '\n';
    appendFileSync(path, lines, 'utf-8');
  } catch (e) {
    // Silently fail to avoid disrupting main flow
    console.error('[routing-telemetry] Flush failed:', e);
  }
}

export function enableRoutingTelemetry(options?: { logDir?: string; flushIntervalMs?: number }): void {
  if (routingLogEnabled) return;
  routingLogEnabled = true;
  if (options?.logDir) routingLogDir = options.logDir;
  if (options?.flushIntervalMs) {
    // Re-create interval with new flush interval
    if (routingLogInterval) clearInterval(routingLogInterval);
  }
  routingLogInterval = setInterval(flushRoutingLog, options?.flushIntervalMs ?? ROUTING_LOG_FLUSH_INTERVAL_MS);
  routingLogInterval.unref?.();
}

export function disableRoutingTelemetry(): void {
  if (!routingLogEnabled) return;
  routingLogEnabled = false;
  flushRoutingLog();
  if (routingLogInterval) {
    clearInterval(routingLogInterval);
    routingLogInterval = null;
  }
}

export function logRoutingDecision(entry: RoutingTelemetryEntry): void {
  if (!routingLogEnabled) return;
  routingLogBuffer.push(entry);
  // Flush immediately on circuit breaker events
  if (entry.demoted || !entry.success) {
    flushRoutingLog();
  }
}

export function getRoutingLogStatus(): { enabled: boolean; bufferSize: number; logPath: string } {
  return {
    enabled: routingLogEnabled,
    bufferSize: routingLogBuffer.length,
    logPath: getRoutingLogPath(),
  };
}
