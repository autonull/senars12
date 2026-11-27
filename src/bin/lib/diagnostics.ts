/**
 * Shared diagnostic utilities for doctor, status, and self-report entry points.
 * Eliminates duplication in NAR creation, config loading, and probe functions.
 */

import { createBotNAR } from '@senars/agent';
import { NARBuilder } from '@senars/agent';
import { createLMService, createSeNARSRegistry } from '@senars/lm';
import { mettaPort } from './metta';
import { loadConfig, systemOneDefaults, systemOneSchema } from '../../config/index';
import { DEFAULT_NAR_STATE_PATH, readPersistedBoundary } from '../../state/index';
import { probeEmbeddedLlama, probeModelsEndpoint, probeJson, endpointPath, resolveLMSettings, cloudApiKey } from '../../lm/index';
import { runHealthChecks } from '../../health/index';

/**
 * Create a minimal NAR instance for diagnostic purposes (no session, no dialogue, no transports).
 * Uses the bare kernel with optional System One config.
 */
export async function createDiagnosticNAR(options: {
  systemOne?: Parameters<typeof NARBuilder.prototype.withNarConfig>[0]['systemOne'];
  withLM?: boolean;
  maxConcepts?: number;
} = {}): Promise<{ nar: Awaited<ReturnType<typeof createBotNAR>>['nar']; dispose: () => Promise<void> }> {
  const { systemOne, withLM = false, maxConcepts = 100 } = options;

  if (withLM) {
    const registry = createSeNARSRegistry();
    const lmService = createLMService();
    const nar = (
      await new NARBuilder()
        .withLM(lmService)
        .withMetta(mettaPort())
        .withNarConfig({
          providerRegistry: registry,
          systemOne,
          enableTools: true,
          maxConcepts,
          persistState: false,
        })
        .build()
    ).nar;
    return { nar, dispose: () => nar.dispose() };
  }

  const nar = createBotNAR({ systemOne, maxConcepts });
  return { nar, dispose: () => nar.dispose() };
}

/**
 * Load app config and extract System One config with provenance.
 */
export async function loadDiagnosticConfig(): Promise<{
  config: Awaited<ReturnType<typeof loadConfig>>;
  systemOneConfig: Parameters<typeof NARBuilder.prototype.withNarConfig>[0]['systemOne'];
  provenance: 'config-file' | 'default';
  statePath: string;
}> {
  const config = await loadConfig();
  const systemOne = config.systemOne ?? systemOneSchema.parse({});
  const provenance =
    config.systemOne === undefined || JSON.stringify(config.systemOne) === JSON.stringify(systemOneDefaults)
      ? 'default'
      : 'config-file';
  const statePath = config.backends.nar.statePath ?? DEFAULT_NAR_STATE_PATH();
  return { config, systemOneConfig: systemOne, provenance, statePath };
}

/**
 * Read persisted boundary from state path.
 */
export function readPersistedState(statePath: string): { cycleCount: number; pendingTasks: number } | null {
  const boundary = readPersistedBoundary(statePath);
  if (!boundary) return null;
  return {
    cycleCount: boundary.cycleCount,
    pendingTasks: boundary.pendingTasks.length,
  };
}

/**
 * Probe LM provider reachability (used by deep health checks).
 */
export async function probeLMProvider(): Promise<boolean> {
  const settings = resolveLMSettings();
  if (settings.provider === 'transformers' || settings.provider === 'mock') return true;
  if (settings.provider !== 'openai-compatible') return Boolean(cloudApiKey(settings.apiKeyEnv));
  return probeModelsEndpoint(
    settings.baseUrl ?? 'http://localhost:11434/v1',
    settings.provider,
    cloudApiKey(settings.apiKeyEnv),
    3000
  );
}

/**
 * Probe Ollama daemon.
 */
export async function probeOllama(host?: string): Promise<string> {
  const data = await probeJson<{ models?: Array<{ name?: string }> }>(
    endpointPath(host ?? 'http://localhost:11434', 'api/tags'),
    { timeoutMs: 3000 }
  );
  if (!data) return 'unreachable (is ollama running?)';
  return `online, models: ${data.models?.map((m) => m.name).join(', ') || 'none'}`;
}

/**
 * Probe embedded llama.cpp.
 */
export async function probeEmbedded(): Promise<{ available: boolean; detail: string }> {
  return probeEmbeddedLlama();
}

/**
 * Run deep health checks against a bare kernel.
 */
export async function runDeepHealthChecks(options: {
  createNAR: () => Promise<{ nar: Awaited<ReturnType<typeof createBotNAR>>['nar']; dispose: () => Promise<void> }>;
}): Promise<{
  ready: boolean;
  checks: Record<string, { ok: boolean; detail: string }>;
}> {
  const { nar, dispose } = await options.createNAR();
  try {
    const report = await runHealthChecks({
      gates: nar.gates,
      lmReachable: probeLMProvider,
    });
    return {
      ready: report.ready,
      checks: Object.fromEntries(
        Object.entries(report.checks).map(([k, v]) => [k, { ok: v.ok, detail: v.detail ?? '' }])
      ),
    };
  } finally {
    await dispose();
  }
}

/**
 * Benchmark derivation costs with a fixed LM-free workload.
 */
export interface DerivationCost {
  conclusion: string;
  rule: string;
  calls: number;
  cpuMs: number;
  durationMs: number;
}

const BENCH_BELIEFS = [
  '<a-->b>. %1.0;0.9%',
  '<b-->c>. %1.0;0.9%',
  '<c-->d>. %1.0;0.9%',
  '<d-->e>. %1.0;0.9%',
  '<e-->f>. %1.0;0.9%',
] as const;
const BENCH_QUESTION = '<a-->f>?';

export async function runDerivationBenchmarks(options: { cycles?: number; limit?: number } = {}): Promise<DerivationCost[]> {
  const { nar, dispose } = await createDiagnosticNAR({ maxConcepts: 100 });
  const costs = new Map<string, DerivationCost>();

  const unsubscribe = nar.getSystemEventBus().on('rule:applied', (e: unknown) => {
    const event = e as { ruleId: string; conclusion: unknown; cpuMs?: number; duration?: number };
    const key = `${event.ruleId}\u0000${String(event.conclusion)}`;
    const row = costs.get(key) ?? {
      conclusion: String(event.conclusion),
      rule: event.ruleId,
      calls: 0,
      cpuMs: 0,
      durationMs: 0,
    };
    row.calls++;
    row.cpuMs += event.cpuMs ?? 0;
    row.durationMs += event.duration ?? 0;
    costs.set(key, row);
  });

  try {
    await nar.run(1);
    for (const belief of BENCH_BELIEFS) await nar.believe(belief);
    await nar.question(BENCH_QUESTION);
    await nar.run(options.cycles ?? 24);
  } finally {
    unsubscribe();
    await dispose();
  }

  return [...costs.values()]
    .sort((a, b) => b.cpuMs - a.cpuMs || b.durationMs - a.durationMs || b.calls - a.calls)
    .slice(0, options.limit ?? 10);
}

/**
 * Get routing matrix for all LM tasks.
 */
export async function getRoutingMatrix(): Promise<Record<string, string[]>> {
  const { LM_TASKS, getModelChain, resolveLMConfig } = await import('@senars/lm');
  const lmConfig = resolveLMConfig();
  const matrix: Record<string, string[]> = {};
  for (const task of LM_TASKS) {
    matrix[task] = getModelChain(lmConfig.provider, task);
  }
  return matrix;
}

/**
 * Get offline tier and demoted providers.
 */
export async function getRoutingInfo(): Promise<{ offlineTier: string | null; demoted: Array<{ id: string; reason: string; at: number }> }> {
  const { resolveOfflineTier, resolveLMSettings, getRoutingStatus } = await import('@senars/lm');
  const settings = resolveLMSettings();
  const offline = resolveOfflineTier(settings);
  const routing = getRoutingStatus();
  return { offlineTier: offline ?? null, demoted: routing.demoted };
}

/**
 * Get circuit breaker status for all providers.
 */
export async function getCircuitBreakers(): Promise<Record<string, { config: unknown; state: string; failures: number }>> {
  const { LM_PROVIDER_NAMES, getEffectiveCircuitConfig, getCircuitBreaker, resolveLMSettings } = await import('@senars/lm');
  const settings = resolveLMSettings();
  const breakers: Record<string, { config: unknown; state: string; failures: number }> = {};
  for (const p of LM_PROVIDER_NAMES) {
    const cfg = getEffectiveCircuitConfig(p, settings);
    const breaker = getCircuitBreaker(p);
    breakers[p] = {
      config: { failureThreshold: cfg.failureThreshold, resetTimeoutMs: cfg.resetTimeoutMs, successThreshold: cfg.successThreshold },
      state: breaker.state,
      failures: breaker.consecutiveFailures,
    };
  }
  return breakers;
}

/**
 * Get routing log status.
 */
export async function getRoutingLogStatus(): Promise<{ enabled: boolean; bufferSize: number; logPath: string }> {
  const { getRoutingLogStatus: fn } = await import('@senars/lm');
  return fn();
}

/**
 * Get credentials report.
 */
export async function getCredentials(): Promise<Array<{ key: string; present: boolean }>> {
  const { credentialReport } = await import('./doctor-checks');
  return credentialReport();
}

import { formatBytes } from '@senars/util/format';
import { existsSync, statSync } from 'node:fs';

/**
 * Check if a file exists and get its size.
 */
export function fileInfo(path: string): { exists: boolean; bytes: number } {
  if (!existsSync(path)) return { exists: false, bytes: 0 };
  return { exists: true, bytes: statSync(path).size };
}