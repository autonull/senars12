/**
 * `senars doctor check` — Onboarding health check:
 * credentials, embedded probe, config-file validation, effective LM matrix.
 */

import { cpus } from 'node:os';
import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { resolveLMSettings, resolveLMConfig, cloudApiKey } from '@senars/lm';
import { loadConfig, systemOneDefaults, systemOneSchema } from '../../../config/index';
import { createLogger, parseFlags, jsonMode, keyedBy, mapValues, errMsg, formatBytes } from '@senars/util';
import {
  createDiagnosticNAR,
  loadDiagnosticConfig,
  readPersistedState,
  probeOllama,
  probeEmbedded,
  runDeepHealthChecks,
  runDerivationBenchmarks,
  getRoutingMatrix,
  getRoutingInfo,
  getCircuitBreakers,
  getRoutingLogStatus,
  getCredentials,
} from '../../lib/diagnostics';
import type { HealthReport } from '@senars/types/health';

const logger = createLogger({ scope: 'doctor:check' });

export const sections: HelpSection[] = [
  standardSections.usage('senars doctor check', 'Run onboarding health check'),
  {
    title: 'Options',
    lines: [
      '--json               Output machine-readable JSON',
      '--degradation        Show graceful degradation posture',
      '--routing-log        Show routing telemetry summary',
      '--benchmarks         Show costliest derivations from fixed workload',
      '--deep               Run shared readiness checks against bare kernel (LM/gates)',
    ],
  },
  standardSections.examples([
    'senars doctor check',
    'senars doctor check --json',
    'senars doctor check --deep --degradation',
    'senars doctor check --benchmarks',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const showDegradation = argv.has('--degradation');
  const showRoutingLog = argv.has('--routing-log');
  const showBenchmarks = argv.has('--benchmarks');
  const deep = argv.has('--deep');

  if (!jsonOutput) console.log('=== SeNARS doctor check ===\n');

  // Effective LM resolution
  const settings = resolveLMSettings();
  const lmConfig = resolveLMConfig();

  const output: Record<string, unknown> = {
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
    const { config, provenance, statePath } = await loadDiagnosticConfig();
    output.config = {
      valid: true,
      profile: { name: config.profile.name, personality: config.profile.personality },
      backends: { nar: config.backends.nar.enabled },
      provenance,
    };
    const { setRouting } = await import('@senars/lm');
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
      for (const [task, chain] of Object.entries(output.routingMatrix as Record<string, string[]>)) {
        console.log(`  ${task}: ${chain.join(' → ')}`);
      }
    }

    const { offlineTier, demoted } = await getRoutingInfo();
    output.offlineTier = offlineTier;
    output.demoted = demoted;
    if (!jsonOutput && offlineTier) console.log(`offline tier: ${offlineTier}`);
    if (!jsonOutput && demoted.length) {
      console.log(`demoted: ${demoted.map((d: { id: string; reason: string }) => `${d.id} (${d.reason})`).join(', ')}`);
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
      circuitBreakers: mapValues(output.circuitBreakers as Record<string, { state: string; failures: number }>, (v) => ({
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
      const { runHealthChecks } = await import('../../../health/index');
      const { probeLMProvider: probeLM } = await import('../../lib/diagnostics');
      const report = await runHealthChecks({
        gates: nar.gates,
        lmReachable: probeLM,
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
      `Embedded llama.cpp: ${(output.embeddedLlama as { available: boolean; detail: string }).available ? '✓ ' + (output.embeddedLlama as { available: boolean; detail: string }).detail : '✗ ' + (output.embeddedLlama as { available: boolean; detail: string }).detail}`
    );
    console.log(`Ollama daemon (local OpenAI-compatible): ${output.ollama}`);
    console.log(`CPUs: ${output.cpus}`);
    console.log(
      `Config: ${(output.config as { valid: boolean; error?: string }).valid ? 'valid' : 'invalid'}${(output.config as { valid: boolean; error?: string }).error ? ` (${(output.config as { valid: boolean; error?: string }).error})` : ''}`
    );
    console.log(
      output.persisted
        ? `Persisted state: ${(output.persisted as { statePath: string; cycleCount: number; pendingTasks: number }).statePath} (cycle ${(output.persisted as { statePath: string; cycleCount: number; pendingTasks: number }).cycleCount}, ${(output.persisted as { statePath: string; cycleCount: number; pendingTasks: number }).pendingTasks} pending)`
        : 'Persisted state: none'
    );

    if (!showDegradation) {
      console.log('\nSee docs/tech/lm-config.md for the provider × tier × credential matrix.');
    }

    if (showDegradation && output.degradation) {
      console.log('\n--- Degradation Posture ---');
      console.log(`Active provider: ${(output.degradation as { activeProvider: string }).activeProvider}`);
      console.log(
        `Effective chain (quality): ${(output.degradation as { effectiveChains: Record<string, string[]> }).effectiveChains.quality?.join(' → ') ?? 'N/A'}`
      );
      console.log('Circuit breakers:');
      for (const [p, v] of Object.entries((output.degradation as { circuitBreakers: Record<string, { state: string; failures: number }> }).circuitBreakers ?? {})) {
        console.log(`  ${p}: ${v.state} (failures=${v.failures})`);
      }
      console.log(`Offline tier: ${(output.degradation as { offlineTier: string | null }).offlineTier ?? 'none'}`);
      console.log(
        `Credentials: ${Object.entries((output.degradation as { credentials: Record<string, boolean> }).credentials ?? {})
          .map(([k, v]) => `${k} ${v ? '✓' : '·'}`)
          .join(', ')}`
      );
    }

    if (showRoutingLog && output.routingLog) {
      console.log('\n--- Routing Telemetry ---');
      console.log(`Enabled: ${(output.routingLog as { enabled: boolean }).enabled}`);
      console.log(`Buffer: ${(output.routingLog as { bufferSize: number }).bufferSize}`);
      console.log(`Log: ${(output.routingLog as { logPath: string }).logPath}`);
    }

    if (showBenchmarks && output.benchmarks) {
      console.log('\n--- Costly Derivations (measured rule fires) ---');
      const benchmarks = output.benchmarks as Array<{ conclusion: string; rule: string; calls: number; cpuMs: number; durationMs: number }>;
      if (!benchmarks.length) console.log('(no rule fires produced by the benchmark workload)');
      else
        for (const b of benchmarks)
          console.log(
            `  ${b.rule.padEnd(20)} ${b.conclusion}  calls=${b.calls} cpuMs=${b.cpuMs.toFixed(2)} durationMs=${b.durationMs.toFixed(2)}`
          );
    }

    if (output.deep) {
      console.log(`\n--- Deep Health (${(output.deep as { ready: boolean }).ready ? 'READY' : 'NOT READY'}) ---`);
      for (const [name, v] of Object.entries((output.deep as { checks: Record<string, { ok: boolean; detail: string }> }).checks)) {
        console.log(`  ${name}: ${v.ok ? '✓' : '✗'} ${v.detail}`);
      }
    }
  }
}

// Allow direct execution for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}