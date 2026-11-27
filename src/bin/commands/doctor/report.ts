/**
 * `senars doctor report` — Generate comprehensive diagnostic report.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { resolveLMSettings, resolveLMConfig, cloudApiKey } from '@senars/lm';
import { loadConfig } from '../../../config/index';
import { createLogger } from '@senars/util/logger';
import { parseFlags, jsonMode } from '@senars/util/cli';
import { formatBytes } from '@senars/util/format';
import { errMsg } from '@senars/util/error';
import {
  createDiagnosticNAR,
  loadDiagnosticConfig,
  readPersistedState,
  probeOllama,
  probeEmbedded,
  getCredentials,
  getRoutingMatrix,
  getRoutingInfo,
  getCircuitBreakers,
  getRoutingLogStatus,
  runDerivationBenchmarks,
  probeLMProvider,
} from '../../lib/diagnostics';
import { runHealthChecks } from '../../../health/index';

const logger = createLogger({ scope: 'doctor:report' });

export const sections: HelpSection[] = [
  standardSections.usage('senars doctor report', 'Generate comprehensive diagnostic report'),
  {
    title: 'Options',
    lines: [
      '--json               Output machine-readable JSON',
      '--output <path>      Write report to file',
      '--deep               Include deep health checks',
      '--benchmarks         Include derivation benchmarks',
      '--full               Include all sections (deep + benchmarks + routing + config)',
    ],
  },
  standardSections.examples([
    'senars doctor report',
    'senars doctor report --json',
    'senars doctor report --output report.json',
    'senars doctor report --full',
  ]),
];

interface ReportOutput {
  timestamp: string;
  version: string;
  lm: {
    provider: string;
    model: string;
    available: boolean;
    cloudCredentials: boolean;
    settings: Record<string, unknown>;
    resolvedConfig: Record<string, unknown>;
  };
  config: {
    valid: boolean;
    profile?: { name: string; personality: string };
    backends?: { nar: boolean };
    provenance?: string;
    error?: string;
    raw?: Record<string, unknown>;
  };
  credentials: Array<{ key: string; present: boolean }>;
  ollama: string;
  embeddedLlama: { available: boolean; detail: string };
  system: {
    cpus: number;
    memory: { total: number; free: number; used: number };
    platform: string;
    arch: string;
    nodeVersion: string;
  };
  persisted: { statePath: string; cycleCount: number; pendingTasks: number } | null;
  routing: {
    matrix: Record<string, string[]>;
    offlineTier: string | null;
    demoted: Array<{ id: string; reason: string; at: number }>;
    circuitBreakers: Record<string, { config: unknown; state: string; failures: number }>;
    log: { enabled: boolean; bufferSize: number; logPath: string };
  };
  deepHealth?: { ready: boolean; checks: Record<string, { ok: boolean; detail: string }> };
  benchmarks?: Array<{ conclusion: string; rule: string; calls: number; cpuMs: number; durationMs: number }>;
  nar?: { concepts: number; gates: number; systemOneEnabled: boolean };
}

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const outputPath = argv.str('--output');
  const deep = argv.has('--deep') || argv.has('--full');
  const benchmarks = argv.has('--benchmarks') || argv.has('--full');
  const full = argv.has('--full');

  const { cpus, freemem, totalmem, platform, arch, version } = await import('node:os');
  const { getVersion } = await import('../../lib/cli-utils');

  const settings = resolveLMSettings();
  const lmConfig = resolveLMConfig();
  const versionStr = getVersion();

  const output: ReportOutput = {
    timestamp: new Date().toISOString(),
    version: versionStr,
    lm: {
      provider: lmConfig.provider,
      model: settings.model ?? 'default',
      available: settings.provider !== 'mock',
      cloudCredentials: Boolean(cloudApiKey()),
      settings: { provider: settings.provider, model: settings.model, ollamaHost: settings.ollamaHost },
      resolvedConfig: { provider: lmConfig.provider, chains: {} },
    },
    config: { valid: false },
    credentials: await getCredentials(),
    ollama: await probeOllama(settings.ollamaHost),
    embeddedLlama: await probeEmbedded(),
    system: {
      cpus: cpus().length,
      memory: { total: totalmem(), free: freemem(), used: totalmem() - freemem() },
      platform,
      arch,
      nodeVersion: version,
    },
    persisted: null,
    routing: {
      matrix: {},
      offlineTier: null,
      demoted: [],
      circuitBreakers: {},
      log: getRoutingLogStatus(),
    },
  };

  // Load config with full details
  try {
    const { config, systemOneConfig, provenance, statePath } = await loadDiagnosticConfig();
    output.config = {
      valid: true,
      profile: { name: config.profile.name, personality: config.profile.personality },
      backends: { nar: config.backends.nar.enabled },
      provenance,
      raw: { systemOne: systemOneConfig },
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
    output.routing.matrix = await getRoutingMatrix();
    const { offlineTier, demoted } = await getRoutingInfo();
    output.routing.offlineTier = offlineTier;
    output.routing.demoted = demoted;
    output.routing.circuitBreakers = await getCircuitBreakers();
  } catch {
    /* routing info is best-effort */
  }

  // Deep health checks
  if (deep) {
    const { nar, dispose } = await createDiagnosticNAR({ withLM: true });
    try {
      const report = await runHealthChecks({
        gates: nar.gates,
        lmReachable: probeLMProvider,
      });
      output.deepHealth = {
        ready: report.ready,
        checks: Object.fromEntries(
          Object.entries(report.checks).map(([k, v]) => [k, { ok: v.ok, detail: v.detail ?? '' }])
        ),
      };
      output.nar = {
        concepts: nar.concepts.size,
        gates: Object.keys(nar.gates).length,
        systemOneEnabled: (nar as unknown as { systemOne?: { enabled?: boolean } }).systemOne?.enabled ?? false,
      };
    } finally {
      await dispose();
    }
  }

  // Benchmarks
  if (benchmarks) {
    output.benchmarks = await runDerivationBenchmarks();
  }

  const result = jsonOutput ? JSON.stringify(output, null, 2) : formatReport(output);

  if (outputPath) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(outputPath, result);
    if (!jsonOutput) console.log(`Report written to ${outputPath}`);
  } else {
    console.log(result);
  }
}

function formatReport(r: ReportOutput): string {
  const lines = [
    '=== SeNARS Diagnostic Report ===',
    `Timestamp: ${r.timestamp}`,
    `Version: ${r.version}`,
    '',
    '--- LM Configuration ---',
    `Provider: ${r.lm.provider}`,
    `Model: ${r.lm.model}`,
    `Available: ${r.lm.available ? 'yes' : 'no'}`,
    `Cloud Credentials: ${r.lm.cloudCredentials ? 'configured' : 'missing'}`,
    '',
    '--- Config ---',
    `Valid: ${r.config.valid ? 'yes' : 'no'}${r.config.error ? ` (${r.config.error})` : ''}`,
    r.config.profile ? `Profile: ${r.config.profile.name} (${r.config.profile.personality})` : '',
    r.config.backends ? `NAR Backend: ${r.config.backends.nar ? 'enabled' : 'disabled'}` : '',
    r.config.provenance ? `System One Config: ${r.config.provenance}` : '',
    '',
    '--- Credentials ---',
    ...r.credentials.map((c) => `  ${c.key}=${c.present ? 'set' : 'unset'}`),
    '',
    '--- Local Services ---',
    `Ollama: ${r.ollama}`,
    `Embedded llama.cpp: ${r.embeddedLlama.available ? '✓ ' + r.embeddedLlama.detail : '✗ ' + r.embeddedLlama.detail}`,
    '',
    '--- System ---',
    `CPUs: ${r.system.cpus}`,
    `Memory: ${formatBytes(r.system.memory.used)} / ${formatBytes(r.system.memory.total)} (${formatBytes(r.system.memory.free)} free)`,
    `Platform: ${r.system.platform} ${r.system.arch}`,
    `Node: ${r.system.nodeVersion}`,
    '',
    '--- Persisted State ---',
    r.persisted
      ? `Path: ${r.persisted.statePath} (cycle ${r.persisted.cycleCount}, ${r.persisted.pendingTasks} pending)`
      : 'No persisted state found',
    '',
    '--- Routing ---',
  ];

  for (const [task, chain] of Object.entries(r.routing.matrix)) {
    lines.push(`  ${task}: ${chain.join(' → ')}`);
  }
  if (r.routing.offlineTier) lines.push(`Offline tier: ${r.routing.offlineTier}`);
  if (r.routing.demoted.length) {
    lines.push(`Demoted: ${r.routing.demoted.map((d) => `${d.id} (${d.reason})`).join(', ')}`);
  }

  lines.push('', '--- Circuit Breakers ---');
  for (const [p, v] of Object.entries(r.routing.circuitBreakers)) {
    lines.push(`  ${p}: ${v.state} (failures=${v.failures})`);
  }

  lines.push('', '--- Routing Log ---');
  lines.push(`  Enabled: ${r.routing.log.enabled}`);
  lines.push(`  Buffer: ${r.routing.log.bufferSize}`);
  lines.push(`  Path: ${r.routing.log.logPath}`);

  if (r.deepHealth) {
    lines.push('', `--- Deep Health (${r.deepHealth.ready ? 'READY' : 'NOT READY'}) ---`);
    for (const [name, v] of Object.entries(r.deepHealth.checks)) {
      lines.push(`  ${name}: ${v.ok ? '✓' : '✗'} ${v.detail}`);
    }
  }

  if (r.benchmarks) {
    lines.push('', '--- Derivation Benchmarks ---');
    if (!r.benchmarks.length) lines.push('  (no rule fires produced by the benchmark workload)');
    else
      for (const b of r.benchmarks)
        lines.push(`  ${b.rule.padEnd(20)} ${b.conclusion}  calls=${b.calls} cpuMs=${b.cpuMs.toFixed(2)} durationMs=${b.durationMs.toFixed(2)}`);
  }

  if (r.nar) {
    lines.push('', '--- NAR ---');
    lines.push(`  Concepts: ${r.nar.concepts}`);
    lines.push(`  Gates: ${r.nar.gates}`);
    lines.push(`  System One: ${r.nar.systemOneEnabled ? 'enabled' : 'disabled'}`);
  }

  return lines.join('\n');
}

export const doctorReportModule: CommandModule = {
  main,
  sections,
};

// Allow direct execution for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}