import { periodic } from '@senars/util';
import { recordLmProbe } from '../../metrics/index.js';
import { cloudApiKey, LM_PROVIDER_NAMES, type LMSettings } from '../env-config.js';
import {
  delegate,
  getProviderRuntime,
  type LMProviderName,
  type ProviderRuntime,
} from '../provider-runtime.js';
import { hasCloudCredentials } from './chains.js';
import { probeEmbeddedLlama } from './embedded-llamacpp.js';
import { probeLlamaCpp } from './llamacpp.js';
import { probeModelsEndpoint } from './probe.js';
import { getLMSettings, getLmProvider } from './settings.js';

/** Probe an OpenAI-compatible endpoint (/models); auth header sent only when a key is available. */
export async function probeOpenAICompatible(settings?: LMSettings): Promise<boolean> {
  const s = settings ?? getLMSettings();
  return probeModelsEndpoint(
    s.baseUrl ?? 'http://localhost:11434/v1',
    s.provider,
    cloudApiKey(s.apiKeyEnv)
  );
}

const OFFLINE_SAFE_PROVIDERS: readonly LMProviderName[] = [
  'mock',
  'webllm',
  'llamacpp',
  'llamacpp-embedded',
];

export async function resolveActiveProvider(): Promise<LMProviderName> {
  const configured = getLmProvider();
  // H4/X17: hard offline switch — never probe; local/mock resolve immediately.
  if (getLMSettings().offline) {
    return OFFLINE_SAFE_PROVIDERS.includes(configured) ? configured : 'mock';
  }
  if (configured === 'mock') return 'mock';
  if (configured === 'webllm') {
    return typeof navigator !== 'undefined' && 'gpu' in navigator ? 'webllm' : 'transformers';
  }
  if (configured === 'transformers') {
    if (hasCloudCredentials()) return 'openai-compatible';
    if (await probeOpenAICompatible()) return 'openai-compatible';
    if (await probeEmbeddedLlama()) return 'llamacpp-embedded';
    return (await probeLlamaCpp()) ? 'llamacpp' : 'mock';
  }
  if (configured === 'llamacpp') return (await probeLlamaCpp()) ? 'llamacpp' : 'mock';
  if (configured === 'llamacpp-embedded')
    return (await probeEmbeddedLlama()) ? 'llamacpp-embedded' : 'mock';
  if (configured === 'openai-compatible')
    return (await probeOpenAICompatible()) ? 'openai-compatible' : 'mock';
  return hasCloudCredentials() ? configured : 'mock';
}

// ---- Health probe & circuit breaker for cloud providers ----
// Breaker state lives on `ProviderRuntime`; the module functions delegate to
// the process-wide default instance (pass an explicit runtime to scope state).

export const getCircuitBreaker = delegate('getCircuitBreaker');
export const getAllCircuitBreakers = delegate('getAllCircuitBreakers');

/** Close all breakers and clear failure counts (test/bench isolation between independent scenarios). */
export const resetCircuitBreakers = delegate('resetCircuitBreakers');

/** Effective circuit breaker config for a provider (settings > provider defaults > global defaults). */
export const getEffectiveCircuitConfig = delegate('getEffectiveCircuitConfig');

export const recordProviderCall = delegate('recordProviderCall');
export const canUseProvider = delegate('canUseProvider');

export async function probeCloudProvider(settings?: LMSettings): Promise<boolean> {
  const s = settings ?? getLMSettings();
  const key = cloudApiKey(s.apiKeyEnv);
  if (!key) return false;
  const baseUrl =
    s.baseUrl ??
    (s.provider === 'anthropic' ? 'https://api.anthropic.com/v1' : 'https://api.openai.com/v1');
  return probeModelsEndpoint(baseUrl, s.provider, key, 5000);
}

export function startHealthProbes(
  intervalMs = 60_000,
  settings?: LMSettings,
  rt: ProviderRuntime = getProviderRuntime()
): void {
  if (rt.healthProbeInterval) return;
  rt.healthProbeInterval = periodic(async () => {
    for (const p of LM_PROVIDER_NAMES) {
      if (!canUseProvider(p, settings, rt)) continue;
      let ok = false;
      switch (p) {
        case 'anthropic':
        case 'openai':
          ok = await probeCloudProvider(settings);
          break;
        case 'openai-compatible':
          ok = await probeOpenAICompatible(settings);
          break;
        case 'webllm':
          ok = typeof navigator !== 'undefined' && 'gpu' in navigator;
          break;
        case 'llamacpp-embedded':
          ok = (await probeEmbeddedLlama()).available;
          break;
        default:
          continue;
      }
      // Record Prometheus metric
      recordLmProbe(p, ok);
      if (ok) rt.recordProbe(p, true);
      else {
        rt.recordProbe(p, false);
        if (rt.breaker(p).state !== 'open') recordProviderCall(p, false, settings, rt);
      }
    }
  }, intervalMs);
}

export function stopHealthProbes(rt: ProviderRuntime = getProviderRuntime()): void {
  if (rt.healthProbeInterval) {
    rt.healthProbeInterval();
    rt.healthProbeInterval = null;
  }
}

// ---- R4: deterministic candidate scoring ----
