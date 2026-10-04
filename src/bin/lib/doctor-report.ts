#!/usr/bin/env tsx
/**
 * `senars doctor` — onboarding health check:
 * credentials, ollama probe, config-file validation, effective LM matrix.
 *
 * Flags:
 *   --json           Output machine-readable JSON
 *   --degradation    Show graceful degradation posture
 *   --routing-log    Show routing telemetry summary
 *   --benchmarks     Show top-10 costly derivations
 *   --deep           Run shared readiness checks against a bare kernel (LM/gates)
 */

import { cpus } from 'node:os';
import { createBotNAR } from '@senars/nar';
import { runHealthChecks } from '@senars/nar/health';
import {
  cloudApiKey,
  fetchBounded,
  getCircuitBreaker,
  getEffectiveCircuitConfig,
  getModelChain,
  getRoutingLogStatus,
  getRoutingStatus,
  LM_PROVIDER_NAMES,
  type LMProviderName,
  type LMTask,
  probeEmbeddedLlama,
  probeLlamaCpp,
  probeModelsEndpoint,
  resolveLMConfig,
  resolveLMSettings,
  resolveOfflineTier,
  setRouting,
} from '@senars/nar/lm';
import { createLogger, envSet, errMsg, keyedBy, mapValues, parseFlags } from '@senars/util';
import { loadConfig } from '../../config/index.js';

const logger = createLogger({ scope: 'doctor' });

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

const probeProviderReachable = async (): Promise<boolean> => {
  const settings = resolveLMSettings();
  if (settings.provider === 'transformers' || settings.provider === 'mock') return true;
  if (settings.provider !== 'openai-compatible') return Boolean(cloudApiKey(settings.apiKeyEnv));
  return probeModelsEndpoint(
    settings.baseUrl ?? 'http://localhost:11434/v1',
    settings.provider,
    cloudApiKey(settings.apiKeyEnv),
    3000
  );
};

const checkCredentials = (): { key: string; present: boolean }[] =>
  ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'LM_API_KEY', 'TAVILY_API_KEY', 'BRAVE_API_KEY'].map(
    (key) => ({
      key,
      present: envSet(key),
    })
  );

const probeOllama = async (host: string): Promise<string> => {
  const res = await fetchBounded(`${host.replace(/\/$/, '')}/api/tags`, { timeoutMs: 3000 });
  if (!res) return 'unreachable (is ollama running?)';
  if (!res.ok) return `unreachable (${res.status})`;
  const data = (await res.json().catch(() => null)) as { models?: Array<{ name?: string }> } | null;
  return `online, models: ${data?.models?.map((m) => m.name).join(', ') || 'none'}`;
};

const flags = parseFlags();
const jsonOutput = flags.has('--json');
const showDegradation = flags.has('--degradation');
const showRoutingLog = flags.has('--routing-log');
const showBenchmarks = flags.has('--benchmarks');
const deep = flags.has('--deep');

interface DoctorOutput {
  lm: {
    provider: string;
    model: string;
    available: boolean;
    tiers: Record<string, string>;
    cloudCredentials: boolean;
    offlineCapable: boolean;
    stats: Record<string, unknown>;
    routing: unknown;
  };
  credentials: Array<{ key: string; present: boolean }>;
  ollama: string;
  embeddedLlama: { available: boolean; detail: string };
  cpus: number;
  config: {
    valid: boolean;
    profile?: { name: string; personality: string };
    backends?: { nar: boolean };
    error?: string;
  };
  routingMatrix: Record<string, string[]>;
  offlineTier: string | null;
  demoted: Array<{ id: string; reason: string; at: number }>;
  circuitBreakers: Record<
    string,
    {
      config: { failureThreshold: number; resetTimeoutMs: number; successThreshold: number };
      state: string;
      failures: number;
    }
  >;
  degradation?: {
    activeProvider: string;
    effectiveChains: Record<string, string[]>;
    circuitBreakers: Record<string, { state: string; failures: number }>;
    offlineTier: string | null;
    credentials: Record<string, boolean>;
  };
  routingLog?: { enabled: boolean; bufferSize: number; logPath: string };
  benchmarks?: unknown[];
  deep?: { ready: boolean; checks: Record<string, { ok: boolean; detail: string }> };
}

const main = async (): Promise<void> => {
  if (!jsonOutput) console.log('=== SeNARS doctor ===\n');

  // Effective LM resolution
  const settings = resolveLMSettings();
  const lmConfig = resolveLMConfig();

  const output: DoctorOutput = {
    lm: {
      provider: lmConfig.provider,
      model: settings.model ?? 'default',
      available: Boolean(settings.provider !== 'mock'),
      tiers: {},
      cloudCredentials: Boolean(cloudApiKey()),
      offlineCapable: true,
      stats: {},
      routing: {},
    },
    credentials: checkCredentials(),
    ollama: await probeOllama(settings.ollamaHost ?? 'http://localhost:11434'),
    embeddedLlama: await probeEmbeddedLlama(),
    cpus: cpus().length,
    config: { valid: false },
    routingMatrix: {},
    offlineTier: null,
    demoted: [],
    circuitBreakers: {},
  };

  // Load config
  try {
    const config = await loadConfig();
    output.config = {
      valid: true,
      profile: { name: config.profile.name, personality: config.profile.personality },
      backends: { nar: config.backends.nar.enabled },
    };
    if (config.routing) setRouting(config.routing as never);
  } catch (e) {
    output.config = { valid: false, error: errMsg(e) };
  }

  // Routing matrix
  try {
    const tasks: LMTask[] = ['quality', 'fast', 'structured'];
    for (const task of tasks) {
      const chain = getModelChain(lmConfig.provider, task);
      output.routingMatrix[task] = chain;
      if (!jsonOutput) console.log(`  ${task}: ${chain.join(' → ')}`);
    }
    const offline = resolveOfflineTier(resolveLMSettings());
    output.offlineTier = offline ?? null;
    if (!jsonOutput && offline) console.log(`offline tier: ${offline}`);
    const routing = getRoutingStatus();
    output.demoted = routing.demoted;
    if (!jsonOutput && routing.demoted.length) {
      console.log(`demoted: ${routing.demoted.map((d) => `${d.id} (${d.reason})`).join(', ')}`);
    }
  } catch {
    /* routing info is best-effort */
  }

  // Circuit breaker status
  try {
    for (const p of LM_PROVIDER_NAMES) {
      const cfg = getEffectiveCircuitConfig(p, settings);
      const breaker = getCircuitBreaker(p);
      output.circuitBreakers[p] = {
        config: {
          failureThreshold: cfg.failureThreshold,
          resetTimeoutMs: cfg.resetTimeoutMs,
          successThreshold: cfg.successThreshold,
        },
        state: breaker.state,
        failures: breaker.consecutiveFailures,
      };
    }
  } catch {
    /* circuit breaker info is best-effort */
  }

  // Degradation posture
  if (showDegradation) {
    const creds = checkCredentials();
    output.degradation = {
      activeProvider: lmConfig.provider,
      effectiveChains: output.routingMatrix,
      circuitBreakers: mapValues(output.circuitBreakers, (v) => ({
        state: v.state,
        failures: v.failures,
      })),
      offlineTier: output.offlineTier,
      credentials: keyedBy(creds, (c) => c.key, (c) => c.present),
    };
  }

  // Routing log status
  if (showRoutingLog) {
    output.routingLog = getRoutingLogStatus();
  }

  // Deep health checks (O3): spin a bare kernel and run the shared readiness checks.
  if (deep) {
    const nar = createBotNAR();
    try {
      const report = await runHealthChecks({
        gates: nar.gates,
        lmReachable: probeProviderReachable,
      });
      output.deep = {
        ready: report.ready,
        checks: mapValues(report.checks, (v) => ({ ok: v.ok, detail: v.detail ?? '' })),
      };
    } finally {
      await nar.dispose();
    }
  }

  // Benchmarks placeholder
  if (showBenchmarks) {
    output.benchmarks = [];
  }

  if (jsonOutput) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`\nLM Provider: ${output.lm.provider}`);
    console.log(`LM Model: ${output.lm.model}`);
    console.log(
      `Embedded llama.cpp: ${output.embeddedLlama.available ? '✓ ' + output.embeddedLlama.detail : '✗ ' + output.embeddedLlama.detail}`
    );
    console.log(`Ollama daemon (local OpenAI-compatible): ${output.ollama}`);
    console.log(`CPUs: ${output.cpus}`);
    console.log(
      `Config: ${output.config.valid ? 'valid' : 'invalid'}${output.config.error ? ` (${output.config.error})` : ''}`
    );

    if (!showDegradation) {
      console.log('\nSee docs/tech/lm-config.md for the provider × tier × credential matrix.');
    }

    if (showDegradation) {
      console.log('\n--- Degradation Posture ---');
      console.log(`Active provider: ${output.degradation?.activeProvider}`);
      console.log(
        `Effective chain (quality): ${output.degradation?.effectiveChains.quality?.join(' → ') ?? 'N/A'}`
      );
      console.log('Circuit breakers:');
      for (const [p, v] of Object.entries(output.degradation?.circuitBreakers ?? {})) {
        console.log(`  ${p}: ${v.state} (failures=${v.failures})`);
      }
      console.log(`Offline tier: ${output.degradation?.offlineTier ?? 'none'}`);
      console.log(
        `Credentials: ${Object.entries(output.degradation?.credentials ?? {})
          .map(([k, v]) => `${k} ${v ? '✓' : '·'}`)
          .join(', ')}`
      );
    }

    if (showRoutingLog) {
      console.log('\n--- Routing Telemetry ---');
      console.log(`Enabled: ${output.routingLog?.enabled}`);
      console.log(`Buffer: ${output.routingLog?.bufferSize}`);
      console.log(`Log: ${output.routingLog?.logPath}`);
    }

    if (showBenchmarks) {
      console.log('\n--- Benchmarks ---');
      console.log('(not yet implemented)');
    }

    if (output.deep) {
      console.log(`\n--- Deep Health (${output.deep.ready ? 'READY' : 'NOT READY'}) ---`);
      for (const [name, v] of Object.entries(output.deep.checks)) {
        console.log(`  ${name}: ${v.ok ? '✓' : '✗'} ${v.detail}`);
      }
    }
  }
};

export const runDoctor = main;

if (process.argv[1]?.endsWith('doctor-report.ts')) {
  main().catch((err) => {
    createLogger({ scope: 'doctor' }).error('doctor failed', err as Error);
    process.exit(1);
  });
}
