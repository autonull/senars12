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
 */

import { cpus } from 'node:os';
import {
  formatLMConfig,
  getModelChain,
  getRoutingStatus,
  getEffectiveCircuitConfig,
  getCircuitBreaker,
  type LMProviderName,
  type LMTask,
  resolveLMConfig,
  resolveLMSettings,
  resolveOfflineTier,
  setRouting,
  getRoutingLogStatus,
} from '@senars/nar/lm';
import { createLogger } from '@senars/nar/logger';
import { loadConfig } from '../config/index.js';
import { getConsolidationWatchdogStatus } from '@senars/nar/memory/pressure';

const logger = createLogger({ scope: 'doctor' });

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

const checkCredentials = (): { key: string; present: boolean }[] =>
  ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'LM_API_KEY', 'TAVILY_API_KEY'].map((key) => ({
    key,
    present: Boolean(process.env[key]),
  }));

const probeOllama = async (host: string): Promise<string> => {
  try {
    const res = await fetch(`${host.replace(/\/$/, '')}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return `unreachable (${res.status})`;
    const data = (await res.json()) as { models?: Array<{ name?: string }> };
    return `online, models: ${data.models?.map((m) => m.model).join(', ') || 'none'}`;
  } catch {
    return 'unreachable (is ollama running?)';
  }
};

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const showDegradation = args.includes('--degradation');
const showRoutingLog = args.includes('--routing-log');
const showBenchmarks = args.includes('--benchmarks');

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
  cpus: number;
  config: {
    valid: boolean;
    profile?: { name: string; personality: string };
    backends?: { nar: boolean; metta: boolean };
    error?: string;
  };
  routingMatrix: Record<string, string[]>;
  offlineTier: string | null;
  demoted: Array<{ id: string; reason: string; at: number }>;
  circuitBreakers: Record<string, {
    config: { failureThreshold: number; resetTimeoutMs: number; successThreshold: number };
    state: string;
    failures: number;
  }>;
  degradation?: {
    activeProvider: string;
    effectiveChains: Record<string, string[]>;
    circuitBreakers: Record<string, { state: string; failures: number }>;
    offlineTier: string | null;
    credentials: Record<string, boolean>;
  };
  routingLog?: { enabled: boolean; bufferSize: number; logPath: string };
  watchdog?: { enabled: boolean; config: Record<string, unknown> };
  benchmarks?: unknown[];
}

const main = async (): Promise<void> => {
  if (!jsonOutput) console.log('=== SeNARS doctor ===\n');

  // Effective LM resolution
  const settings = resolveLMSettings();
  const lmConfig = resolveLMConfig();
  const lmClient = { provider: settings.provider, model: settings.model }; // placeholder

  const output: DoctorOutput = {
    lm: {
      provider: lmConfig.provider,
      model: settings.model ?? 'default',
      available: Boolean(settings.provider !== 'mock'),
      tiers: {},
      cloudCredentials: Boolean(
        process.env.LM_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY
      ),
      offlineCapable: true,
      stats: {},
      routing: {},
    },
    credentials: checkCredentials(),
    ollama: await probeOllama(settings.ollamaHost ?? 'http://localhost:11434'),
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
      backends: { nar: config.backends.nar.enabled, metta: config.backends.metta.enabled },
    };
    if (config.routing) setRouting(config.routing as never);
  } catch (e) {
    output.config = { valid: false, error: (e as Error).message };
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
    const providers: LMProviderName[] = ['anthropic', 'openai', 'openai-compatible', 'ollama', 'transformers', 'mock'];
    for (const p of providers) {
      const cfg = getEffectiveCircuitConfig(p, settings);
      const breaker = getCircuitBreaker(p);
      output.circuitBreakers[p] = {
        config: { failureThreshold: cfg.failureThreshold, resetTimeoutMs: cfg.resetTimeoutMs, successThreshold: cfg.successThreshold },
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
      circuitBreakers: Object.fromEntries(
        Object.entries(output.circuitBreakers).map(([k, v]) => [k, { state: v.state, failures: v.failures }])
      ),
      offlineTier: output.offlineTier,
      credentials: Object.fromEntries(creds.map((c) => [c.key, c.present])),
    };
  }

  // Routing log status
  if (showRoutingLog) {
    output.routingLog = getRoutingLogStatus();
  }

  // Watchdog status
  const watchdogStatus = getConsolidationWatchdogStatus();
  output.watchdog = { enabled: watchdogStatus.enabled, config: watchdogStatus.config };

  // Benchmarks placeholder
  if (showBenchmarks) {
    output.benchmarks = [];
  }

  if (jsonOutput) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    if (!showDegradation) {
      console.log('\nSee docs/tech/lm-config.md for the provider × tier × credential matrix.');
    }

    if (showDegradation) {
      console.log('\n--- Degradation Posture ---');
      console.log(`Active provider: ${output.degradation?.activeProvider}`);
      console.log(`Effective chain (quality): ${output.degradation?.effectiveChains.quality?.join(' → ') ?? 'N/A'}`);
      console.log('Circuit breakers:');
      for (const [p, v] of Object.entries(output.degradation?.circuitBreakers ?? {})) {
        console.log(`  ${p}: ${v.state} (failures=${v.failures})`);
      }
      console.log(`Offline tier: ${output.degradation?.offlineTier ?? 'none'}`);
      console.log(`Credentials: ${Object.entries(output.degradation?.credentials ?? {}).map(([k, v]) => `${k} ${v ? '✓' : '·'}`).join(', ')}`);
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
  }
};

main().catch((err) => {
  createLogger({ scope: 'doctor' }).error('doctor failed', err as Error);
  process.exit(1);
});
