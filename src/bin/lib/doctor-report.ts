#!/usr/bin/env tsx
/**
 * `senars doctor` — onboarding health check:
 * credentials, ollama probe, config-file validation, effective LM matrix.
 *
 * Flags:
 *   --json           Output machine-readable JSON
 *   --degradation    Show graceful degradation posture
 *   --routing-log    Show routing telemetry summary
 *   --benchmarks     Show the costliest derivations from a fixed workload
 *   --deep           Run shared readiness checks against a bare kernel (LM/gates)
 */

import { cpus } from 'node:os';
import { createLogger, errMsg, keyedBy, mapValues, parseFlags, jsonMode } from '@senars/util';
import type { HealthReport } from '@senars/types/health';
import { LM_TASKS } from '@senars/types/llm';
import {
  createDiagnosticNAR,
  loadDiagnosticConfig,
  readPersistedState,
  probeLMProvider,
  probeOllama,
  probeEmbedded,
  runDeepHealthChecks,
  runDerivationBenchmarks,
  getRoutingMatrix,
  getRoutingInfo,
  getCircuitBreakers,
  getRoutingLogStatus,
  getCredentials,
} from './diagnostics';
import { cloudApiKey, resolveLMConfig, resolveLMSettings, setRouting } from '@senars/lm';

const logger = createLogger({ scope: 'doctor' });

const flags = parseFlags();
const jsonOutput = jsonMode();
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
  benchmarks?: Awaited<ReturnType<typeof runDerivationBenchmarks>>;
  deep?: HealthReport;
  persisted: { statePath: string; cycleCount: number; pendingTasks: number } | null;
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
    credentials: await getCredentials(),
    ollama: await probeOllama(settings.ollamaHost),
    embeddedLlama: await probeEmbedded(),
    cpus: cpus().length,
    config: { valid: false },
    routingMatrix: {},
    offlineTier: null,
    demoted: [],
    circuitBreakers: {},
    persisted: null,
  };

  // Load config
  try {
    const { config, systemOneConfig, provenance, statePath } = await loadDiagnosticConfig();
    output.config = {
      valid: true,
      profile: { name: config.profile.name, personality: config.profile.personality },
      backends: { nar: config.backends.nar.enabled },
    };
    if (config.routing) setRouting(config.routing as never);

    const persisted = readPersistedState(statePath);
    if (persisted) output.persisted = { statePath, ...persisted };
  } catch (e) {
    output.config = { valid: false, error: errMsg(e) };
  }

  // Routing matrix
  try {
    output.routingMatrix = await getRoutingMatrix();
    if (!jsonOutput) {
      for (const [task, chain] of Object.entries(output.routingMatrix)) {
        console.log(`  ${task}: ${chain.join(' → ')}`);
      }
    }

    const { offlineTier, demoted } = await getRoutingInfo();
    output.offlineTier = offlineTier;
    output.demoted = demoted;
    if (!jsonOutput && offlineTier) console.log(`offline tier: ${offlineTier}`);
    if (!jsonOutput && demoted.length) {
      console.log(`demoted: ${demoted.map((d) => `${d.id} (${d.reason})`).join(', ')}`);
    }
  } catch {
    /* routing info is best-effort */
  }

  // Circuit breaker status
  try {
    output.circuitBreakers = await getCircuitBreakers();
  } catch {
    /* circuit breaker info is best-effort */
  }

  // Degradation posture
  if (showDegradation) {
    const creds = await getCredentials();
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

  // Deep health checks
  if (deep) {
    const { nar, dispose } = await createDiagnosticNAR({ withLM: true });
    try {
      const report = await runHealthChecks({
        gates: nar.gates,
        lmReachable: probeLMProvider,
      });
      output.deep = {
        ready: report.ready,
        checks: mapValues(report.checks, (v) => ({ ok: v.ok, detail: v.detail ?? '' })),
      };
    } finally {
      await dispose();
    }
  }

  // Benchmarks
  if (showBenchmarks) {
    output.benchmarks = await runDerivationBenchmarks();
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
    console.log(
      output.persisted
        ? `Persisted state: ${output.persisted.statePath} (cycle ${output.persisted.cycleCount}, ${output.persisted.pendingTasks} pending)`
        : 'Persisted state: none'
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
      console.log('\n--- Costly Derivations (measured rule fires) ---');
      if (!output.benchmarks?.length) console.log('(no rule fires produced by the benchmark workload)');
      else
        for (const b of output.benchmarks)
          console.log(
            `  ${b.rule.padEnd(20)} ${b.conclusion}  calls=${b.calls} cpuMs=${b.cpuMs.toFixed(2)} durationMs=${b.durationMs.toFixed(2)}`
          );
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