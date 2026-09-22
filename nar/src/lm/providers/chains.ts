import type { LMExecutionStats, LMTask } from '@senars/util';
import type { LanguageModel } from 'ai';
import type { LMSettings } from '../env-config.js';
import {
  getProviderRuntime,
  type LMProviderName,
  type ProviderRuntime,
} from '../provider-runtime.js';
import { latencyClassOf } from './capabilities.js';
import type { SeNARSModelId, SeNARSRegistry } from './model-factory.js';
import { cloudApiKey } from './model-factory.js';
import { pickModel } from './routing.js';
import { getLMSettings, getLmProvider } from './settings.js';

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
    quality: ['cloud:quality', 'builtin:quality', 'builtin:mock'],
    fast: ['cloud:fast', 'builtin:compact', 'builtin:mock'],
    structured: ['cloud:structured', 'builtin:compact', 'builtin:mock'],
  },
  openai: {
    quality: ['cloud:quality', 'builtin:quality', 'builtin:mock'],
    fast: ['cloud:fast', 'builtin:compact', 'builtin:mock'],
    structured: ['cloud:structured', 'builtin:compact', 'builtin:mock'],
  },
  'openai-compatible': {
    quality: ['cloud:quality', 'builtin:quality', 'builtin:mock'],
    fast: ['cloud:fast', 'builtin:compact', 'builtin:mock'],
    structured: ['cloud:structured', 'builtin:compact', 'builtin:mock'],
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
