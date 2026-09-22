import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { transformersJS } from '@browser-ai/transformers-js';
import type { LMExecutionStats, LMTask } from '@senars/util';
import {
  createProviderRegistry,
  customProvider,
  type LanguageModel,
  type LanguageModelMiddleware,
  wrapLanguageModel,
} from 'ai';
import { recordLmProbe } from '../metrics/index.js';
import {
  builtinModels,
  defaultModelFor,
  embeddedLlamaConfigured,
  type LMSettings,
  type LMSettingsInput,
} from './env-config.js';
import { createMockLanguageModel } from './lm-service.js';
import {
  createEmbeddedLlamaCppLanguageModel,
  probeEmbeddedLlama,
} from './providers/embedded-llamacpp.js';
import { createLlamaCppFetch, LLAMACPP_HOST_DEFAULT, probeLlamaCpp } from './providers/llamacpp.js';

export type { LMTask } from '@senars/util';
export type { LMSettings } from './env-config.js';

const OLLAMA_HOST_DEFAULT = 'http://localhost:11434';
const OLLAMA_FAST_DEFAULT = 'llama3.2:3b';
const OLLAMA_COMPACT_DEFAULT = 'phi3:3.8b';

export type {
  CircuitBreakerConfig,
  CircuitState,
  LMProviderName,
  ProviderHealth,
  ProviderRuntime,
  QualityObjective,
  RoutingDecision,
  RoutingObjective,
  RoutingPolicy,
  RoutingTelemetryEntry,
  WebLLMRuntime,
} from './provider-runtime.js';
export { getProviderRuntime, PROVIDER_CIRCUIT_DEFAULTS } from './provider-runtime.js';
import {
  getProviderRuntime,
  type LMProviderName,
  type ProviderHealth,
  type ProviderRuntime,
  type QualityObjective,
  type RoutingDecision,
  type RoutingObjective,
  type RoutingPolicy,
  type RoutingTelemetryEntry,
  type WebLLMRuntime,
} from './provider-runtime.js';

// Settings/runtime-injection state lives on `ProviderRuntime`; the module
// functions delegate to the process-wide default instance.

/** UI layer installs the WebLLM runtime at startup (browser only). */
export const configureWebLLM = (
  runtime: WebLLMRuntime | undefined,
  rt: ProviderRuntime = getProviderRuntime()
): void => {
  rt.configureWebLLM(runtime);
};
export const getWebLLMRuntime = (rt: ProviderRuntime = getProviderRuntime()) =>
  rt.getWebLLMRuntime();

/** Install file/config-derived settings (env still wins at read time). */
export const configureLM = (settings: LMSettingsInput, rt: ProviderRuntime = getProviderRuntime()): void => {
  rt.configureLM(settings);
};

/** Active settings, lazily resolved from env (+ anything installed via configureLM). */
export const getLMSettings = (rt: ProviderRuntime = getProviderRuntime()): LMSettings =>
  rt.getLMSettings();

export const getLmProvider = (): LMProviderName => getLMSettings().provider;

/** WebGPU auto-detection: prefer webgpu when available, else cpu. */
export const detectDevice = (): 'webgpu' | 'cpu' =>
  typeof navigator !== 'undefined' && 'gpu' in navigator ? 'webgpu' : 'cpu';

/**
 * TransformersJS parses tool calls from fenced JSON and cannot honor
 * `toolChoice`; the AI SDK resolves an absent choice to `{type:'auto'}`,
 * which trips the provider's unsupported-setting warning on every call.
 * Stripping it keeps tools working (fence parsing) without the noise.
 */
const stripUnsupportedToolChoice = (): LanguageModelMiddleware => ({
  transformParams: async ({ params }) => ({ ...params, toolChoice: undefined }),
});

/** Progress callback type for model download/initialization. */
export type ModelDownloadProgressCallback = (progress: number) => void;

const localModel = (
  model: string,
  settings: LMSettings,
  onProgress?: ModelDownloadProgressCallback
): LanguageModel => {
  // H7: per-slot dtype (LM_QUALITY_DTYPE/LM_FAST_DTYPE) over global LM_DTYPE over quantized flag.
  const isQuality = model === settings.model || model === defaultModelFor(settings.provider);
  const dtype =
    (isQuality
      ? (settings.qualityDtype ?? settings.dtype)
      : (settings.fastDtype ?? settings.dtype)) ?? (settings.quantized ? 'q4' : 'fp32');
  return wrapLanguageModel({
    model: transformersJS(model, {
      device: detectDevice(),
      dtype,
      ...(settings.cacheDir ? { cacheDir: settings.cacheDir } : {}),
      ...(onProgress ? { initProgressCallback: onProgress } : {}),
    } as Parameters<typeof transformersJS>[1]),
    middleware: stripUnsupportedToolChoice(),
  });
};

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

export const setBuiltinProgressCallback = (
  cb: ModelDownloadProgressCallback | undefined,
  rt: ProviderRuntime = getProviderRuntime()
): void => {
  rt.setBuiltinProgressCallback(cb);
};
export const getBuiltinProgressCallback = (rt: ProviderRuntime = getProviderRuntime()) =>
  rt.getBuiltinProgressCallback();

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
  const useWebLLM =
    provider === 'webllm' &&
    typeof getWebLLMRuntime() !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'gpu' in navigator;
  const useLlamaCpp = provider === 'llamacpp';
  // GGUF must be configured AND on disk — otherwise the slots are omitted so
  // routing failover skips them (defaults degrade to builtin transformers).
  const useEmbeddedLlamaCpp = provider === 'llamacpp-embedded' && embeddedLlamaConfigured();

  const ollama = createOpenAICompatible({
    name: 'ollama',
    apiKey: 'ollama',
    baseURL: `${(ollamaHost ?? OLLAMA_HOST_DEFAULT).replace(/\/v1\/?$/, '')}/v1`,
  });
  const llamacpp = createOpenAICompatible({
    name: 'llamacpp',
    apiKey: 'none',
    baseURL: `${(s.llamacppHost ?? LLAMACPP_HOST_DEFAULT).replace(/\/v1\/?$/, '')}/v1`,
    // Edge models (Qwen/Gemma reasoners) burn all tokens on reasoning_content
    // by default — thinking stays off unless explicitly re-enabled.
    fetch: createLlamaCppFetch({ disableThinking: s.disableThinking !== false }),
  });
  const thinkingAwareFetch: typeof fetch | undefined = s.disableThinking
    ? (input, init) => {
        if (typeof init?.body === 'string') {
          try {
            const body = JSON.parse(init.body);
            if (body.messages && !body.chat_template_kwargs) {
              body.chat_template_kwargs = { enable_thinking: false };
              init = { ...init, body: JSON.stringify(body) };
            }
          } catch {}
        }
        return fetch(input, init);
      }
    : undefined;
  const cloud = createOpenAICompatible({
    name: 'cloud',
    apiKey: cloudApiKey(s) ?? '',
    baseURL:
      baseUrl ??
      (provider === 'anthropic' ? 'https://api.anthropic.com/v1' : 'https://api.openai.com/v1'),
    ...(thinkingAwareFetch && { fetch: thinkingAwareFetch }),
  });
  const frontierId = modelOverride ?? defaultModelFor(provider);
  const builtinCompact = compactModel ?? builtinModels.compact;
  const offlineTier = resolveOfflineTier(s);

  const webllm = getWebLLMRuntime();
  const webllmQuality = useWebLLM ? webllm!.createModel('llama-3.2-3b-instruct') : undefined;
  const webllmFast = useWebLLM ? webllm!.createModel('phi-3.5-mini-instruct') : undefined;

  // Unavailable slots are omitted (not mocked) so registry.languageModel() throws
  // and routing failover skips them instead of silently admitting a placeholder.
  return createProviderRegistry({
    cloud: customProvider({
      languageModels: {
        ...(useCloud && {
          quality: cloud(frontierId),
          fast: cloud(fastModel ?? frontierId),
          structured: cloud(structuredModel ?? frontierId),
          compact: cloud(compactModel ?? frontierId),
        }),
      },
      fallbackProvider: useCloud ? cloud : undefined,
    }),
    local: customProvider({
      languageModels: {
        ...(useLocal && {
          quality: ollama(modelOverride ?? defaultModelFor('ollama')),
          fast: ollama(fastModel ?? OLLAMA_FAST_DEFAULT),
          compact: ollama(compactModel ?? OLLAMA_COMPACT_DEFAULT),
        }),
      },
      fallbackProvider: useLocal ? ollama : undefined,
    }),
    llamacpp: customProvider({
      languageModels: {
        ...(useLlamaCpp && {
          quality: llamacpp(modelOverride ?? defaultModelFor('llamacpp')),
          fast: llamacpp(fastModel ?? defaultModelFor('llamacpp')),
          structured: llamacpp(structuredModel ?? defaultModelFor('llamacpp')),
          compact: llamacpp(compactModel ?? defaultModelFor('llamacpp')),
        }),
      },
      fallbackProvider: useLlamaCpp ? llamacpp : undefined,
    }),
    'llamacpp-embedded': customProvider({
      languageModels: {
        ...(useEmbeddedLlamaCpp && {
          quality: createEmbeddedLlamaCppLanguageModel('quality'),
          fast: createEmbeddedLlamaCppLanguageModel('fast'),
          structured: createEmbeddedLlamaCppLanguageModel('structured'),
          compact: createEmbeddedLlamaCppLanguageModel('compact'),
        }),
      },
    }),
    webllm: customProvider({
      languageModels: {
        ...(useWebLLM && {
          quality: webllmQuality,
          fast: webllmFast,
          structured: webllmQuality,
          compact: webllmFast,
        }),
      },
      fallbackProvider: useWebLLM ? undefined : undefined,
    }),
    builtin: customProvider({
      languageModels: {
        quality: localModel(
          offlineTier ?? modelOverride ?? builtinModels.quality,
          s,
          getBuiltinProgressCallback()
        ),
        fast: localModel(builtinCompact, s, getBuiltinProgressCallback()),
        structured: localModel(
          offlineTier ?? modelOverride ?? builtinModels.quality,
          s,
          getBuiltinProgressCallback()
        ),
        compact: localModel(builtinCompact, s, getBuiltinProgressCallback()),
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

const embeddedCap = {
  ...localCap,
  latencyClass: 'medium' as const,
};

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
  'llamacpp:quality': { ...localCap, latencyClass: 'medium' },
  'llamacpp:fast': localCap,
  'llamacpp:structured': { ...localCap, latencyClass: 'medium' },
  'llamacpp:compact': localCap,
  'llamacpp-embedded:quality': { ...embeddedCap, latencyClass: 'medium' },
  'llamacpp-embedded:fast': embeddedCap,
  'llamacpp-embedded:structured': { ...embeddedCap, latencyClass: 'medium' },
  'llamacpp-embedded:compact': embeddedCap,
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
 * Objective-driven routing override lives on `ProviderRuntime`
 * (see provider-runtime.ts); the module functions below delegate to the
 * process-wide default instance. Pass an explicit runtime for scoped state.
 */

export const setRouting = (policy: RoutingPolicy | null, rt: ProviderRuntime = getProviderRuntime()): void => {
  rt.setRouting(policy);
};

export const getRouting = (rt: ProviderRuntime = getProviderRuntime()): RoutingPolicy | null =>
  rt.getRouting();

export const demoteModel = (id: string, reason: string, rt: ProviderRuntime = getProviderRuntime()): void => {
  rt.demoteModel(id, reason);
};
export const getDemotions = (rt: ProviderRuntime = getProviderRuntime()) => rt.demotions;
export const resetDemotions = (rt: ProviderRuntime = getProviderRuntime()): void => {
  rt.resetDemotions();
};

export const getLastRoutingDecision = (
  rt: ProviderRuntime = getProviderRuntime()
): RoutingDecision | undefined => rt.lastDecision;

export const getRoutingStatus = (rt: ProviderRuntime = getProviderRuntime()) =>
  rt.getRoutingStatus();

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
  llamacpp: {
    // Explicit provider: authoritative, no silent CPU fallback rungs.
    quality: ['llamacpp:quality'],
    fast: ['llamacpp:fast'],
    structured: ['llamacpp:structured'],
  },
  'llamacpp-embedded': {
    // Embedded provider: authoritative, no silent CPU fallback rungs.
    quality: ['llamacpp-embedded:quality'],
    fast: ['llamacpp-embedded:fast'],
    structured: ['llamacpp-embedded:structured'],
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

export function getModelChain(
  provider: LMProviderName,
  task: LMTask,
  rt: ProviderRuntime = getProviderRuntime()
): SeNARSModelId[] {
  // Mock provider is the test/offline posture: configured routing candidates
  // must not bypass it (a stale senars.config.json would otherwise route a
  // mock lane onto builtin transformers models with minutes-long cold loads).
  if (provider === 'mock') return CHAINS.mock[task];
  const policy = rt.routing;
  const c = policy?.candidates;
  if (c?.length) {
    const obj = policy?.objectives?.[task];
    const offlineOnly = obj?.offlineOnly ?? policy?.offlineOnly;
    const maxLatencyMs = obj?.maxLatencyMs ?? policy?.maxLatencyMs;
    // demoted candidates sink to the back of the chain (session-level)
    const ordered = [...c].sort(
      (a, b) => Number(rt.demotions.has(a)) - Number(rt.demotions.has(b))
    );
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
  // AI SDK may suffix provider names (e.g. 'llamacpp.chat') — normalize to the base key.
  const base = (provider.split('.')[0] ?? provider) as LMProviderName;
  return CHAINS[base]?.[task] ?? CHAINS[getLmProvider()]?.[task] ?? CHAINS.mock[task];
}

export function getModelForTask(
  registry: SeNARSRegistry,
  task: LMTask,
  settings?: LMSettings,
  stats?: Record<string, LMExecutionStats>,
  /** H2/X16: explicit per-call model id (e.g. 'cloud:quality') — bypasses the chain. */
  modelOverride?: string,
  rt: ProviderRuntime = getProviderRuntime()
): LanguageModel {
  if (modelOverride) {
    // Unknown ids throw here — no silent failover (routing honesty rules).
    const model = registry.languageModel(
      modelOverride as Parameters<SeNARSRegistry['languageModel']>[0]
    );
    rt.lastDecision = { task, modelId: modelOverride, reason: 'primary' };
    return model;
  }
  const chain = getModelChain(settings?.provider ?? getLmProvider(), task, rt);
  // R4/R5: success-rate-aware reordering within the resolved chain (failsafe rungs stay
  // guaranteed by pickModel's deterministic tie-breaking and the appended ladder).
  const ordered = (stats ? pickModel(chain, {}, stats).map((c) => c.id) : chain) as SeNARSModelId[];
  for (const [i, id] of ordered.entries()) {
    try {
      const model = registry.languageModel(id);
      rt.lastDecision = { task, modelId: id, reason: i === 0 ? 'primary' : 'failover' };
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

const OFFLINE_SAFE_PROVIDERS: readonly LMProviderName[] = [
  'mock',
  'transformers',
  'webllm',
  'ollama',
  'llamacpp',
  'llamacpp-embedded',
];

export async function resolveActiveProvider(): Promise<LMProviderName> {
  const configured = getLmProvider();
  // H4/X17: hard offline switch — never probe; local/mock resolve immediately.
  if (getLMSettings().offline) {
    return OFFLINE_SAFE_PROVIDERS.includes(configured) ? configured : 'transformers';
  }
  if (configured === 'mock') return 'mock';
  if (configured === 'webllm') {
    return typeof navigator !== 'undefined' && 'gpu' in navigator ? 'webllm' : 'transformers';
  }
  if (configured === 'transformers') {
    if (hasCloudCredentials()) return 'openai-compatible';
    if (await probeOllama()) return 'ollama';
    if (await probeEmbeddedLlama()) return 'llamacpp-embedded';
    return (await probeLlamaCpp()) ? 'llamacpp' : 'transformers';
  }
  if (configured === 'ollama') return (await probeOllama()) ? 'ollama' : 'transformers';
  if (configured === 'llamacpp') return (await probeLlamaCpp()) ? 'llamacpp' : 'transformers';
  if (configured === 'llamacpp-embedded')
    return (await probeEmbeddedLlama()) ? 'llamacpp-embedded' : 'transformers';
  return hasCloudCredentials() ? configured : (await probeOllama()) ? 'ollama' : 'transformers';
}

// ---- Health probe & circuit breaker for cloud providers ----
// Breaker state lives on `ProviderRuntime`; the module functions delegate to
// the process-wide default instance (pass an explicit runtime to scope state).

export function getCircuitBreaker(
  provider: LMProviderName,
  rt: ProviderRuntime = getProviderRuntime()
): ProviderHealth {
  return rt.getCircuitBreaker(provider);
}

export function getAllCircuitBreakers(rt: ProviderRuntime = getProviderRuntime()) {
  return rt.getAllCircuitBreakers();
}

/** Close all breakers and clear failure counts (test/bench isolation between independent scenarios). */
export function resetCircuitBreakers(rt: ProviderRuntime = getProviderRuntime()): void {
  rt.resetCircuitBreakers();
}

/** Effective circuit breaker config for a provider (settings > provider defaults > global defaults). */
export const getEffectiveCircuitConfig = (
  provider: LMProviderName,
  settings?: LMSettings,
  rt: ProviderRuntime = getProviderRuntime()
) => rt.getEffectiveCircuitConfig(provider, settings);

export function recordProviderCall(
  provider: LMProviderName,
  success: boolean,
  settings?: LMSettings,
  rt: ProviderRuntime = getProviderRuntime()
): void {
  rt.recordProviderCall(provider, success, settings);
}

export function canUseProvider(
  provider: LMProviderName,
  settings?: LMSettings,
  rt: ProviderRuntime = getProviderRuntime()
): boolean {
  return rt.canUseProvider(provider, settings);
}

export async function probeCloudProvider(settings?: LMSettings): Promise<boolean> {
  const s = settings ?? getLMSettings();
  const key = cloudApiKey(s);
  if (!key) return false;

  const baseUrl =
    s.baseUrl ??
    (s.provider === 'anthropic' ? 'https://api.anthropic.com/v1' : 'https://api.openai.com/v1');
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000);
    const res = await fetch(`${baseUrl}/models`, {
      signal: ctl.signal,
      headers:
        s.provider === 'anthropic'
          ? { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
          : { Authorization: `Bearer ${key}` },
    });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

export function startHealthProbes(
  intervalMs = 60_000,
  settings?: LMSettings,
  rt: ProviderRuntime = getProviderRuntime()
): void {
  if (rt.healthProbeInterval) return;
  rt.healthProbeInterval = setInterval(async () => {
    const providers: LMProviderName[] = [
      'anthropic',
      'openai',
      'openai-compatible',
      'ollama',
      'webllm',
      'llamacpp-embedded',
    ];
    for (const p of providers) {
      if (!canUseProvider(p, settings, rt)) continue;
      let ok = false;
      if (p === 'ollama') {
        ok = await probeOllama(settings?.ollamaHost);
      } else if (['anthropic', 'openai', 'openai-compatible'].includes(p)) {
        ok = await probeCloudProvider(settings);
      } else if (p === 'webllm') {
        ok = typeof navigator !== 'undefined' && 'gpu' in navigator;
      } else if (p === 'llamacpp-embedded') {
        ok = (await probeEmbeddedLlama()).available;
      }
      const b = rt.breaker(p);
      b.lastProbe = Date.now();
      b.probeResult = ok;
      // Record Prometheus metric
      recordLmProbe(p, ok);
      if (ok && b.state === 'open') {
        b.state = 'half-open';
        b.consecutiveSuccesses = 0;
      } else if (!ok && b.state !== 'open') {
        recordProviderCall(p, false, settings, rt);
      }
    }
  }, intervalMs);
  rt.healthProbeInterval.unref?.();
}

export function stopHealthProbes(rt: ProviderRuntime = getProviderRuntime()): void {
  if (rt.healthProbeInterval) {
    clearInterval(rt.healthProbeInterval);
    rt.healthProbeInterval = null;
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
export const resolveOfflineTier = (
  settings?: LMSettings,
  rt: ProviderRuntime = getProviderRuntime()
): string | undefined => {
  const envModel = process.env.LM_LOCAL_MODEL;
  if (envModel) return envModel;
  const ladder = rt.routing?.offlineLadder;
  if (!ladder?.length) return undefined;
  return resolveOfflineModel(ladder, settings?.cacheDir ?? OFFLINE_CACHE_DIR_DEFAULT);
};

// ---- Routing telemetry (1B) — state on `ProviderRuntime`; delegates below ----

export function enableRoutingTelemetry(
  options?: { logDir?: string; flushIntervalMs?: number },
  rt: ProviderRuntime = getProviderRuntime()
): void {
  rt.enableRoutingTelemetry(options);
}

export function disableRoutingTelemetry(rt: ProviderRuntime = getProviderRuntime()): void {
  rt.disableRoutingTelemetry();
}

export function logRoutingDecision(
  entry: RoutingTelemetryEntry,
  rt: ProviderRuntime = getProviderRuntime()
): void {
  rt.logRoutingDecision(entry);
}

export function getRoutingLogStatus(rt: ProviderRuntime = getProviderRuntime()) {
  return rt.getRoutingLogStatus();
}
