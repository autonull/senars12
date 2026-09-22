import { recordLmProbe } from '../../metrics/index.js';
import type { LMSettings } from '../env-config.js';
import {
  getProviderRuntime,
  type LMProviderName,
  type ProviderHealth,
  type ProviderRuntime,
} from '../provider-runtime.js';
import { hasCloudCredentials } from './chains.js';
import { probeEmbeddedLlama } from './embedded-llamacpp.js';
import { probeLlamaCpp } from './llamacpp.js';
import { cloudApiKey } from './model-factory.js';
import { getLMSettings, getLmProvider } from './settings.js';

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
