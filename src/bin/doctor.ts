#!/usr/bin/env tsx
/**
 * `senars doctor` — onboarding health check:
 * credentials, ollama probe, config-file validation, effective LM matrix.
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
} from '@senars/nar/lm';
import { createLogger } from '@senars/nar/logger';
import { loadConfig } from '../config/index.js';

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

const main = async (): Promise<void> => {
  console.log('=== SeNARS doctor ===\n');

  // Effective LM resolution
  const settings = resolveLMSettings();
  console.log('--- Effective LM ---');
  console.log(formatLMConfig(resolveLMConfig()));
  console.log(
    `fast tier model: ${settings.fastModel ?? '(same provider default)'}\n` +
      'tip: LM_FAST_MODEL / LM_STRUCTURED_MODEL / LM_COMPACT_MODEL set per-tier models\n'
  );

  // Credentials
  console.log('--- Credentials ---');
  for (const { key, present } of checkCredentials()) {
    console.log(`  ${present ? '✓' : '·'} ${key}${present ? '' : ' (not set)'}`);
  }
  console.log();

  // Ollama
  console.log('--- Local providers ---');
  console.log(`ollama: ${await probeOllama(settings.ollamaHost ?? 'http://localhost:11434')}`);
  console.log(`cpus: ${cpus().length}\n`);

  // Config file
  console.log('--- senars.config.json ---');
  try {
    const config = await loadConfig();
    console.log('✓ valid');
    console.log(`profile: ${config.profile.name} — ${config.profile.personality}`);
    console.log(
      `backends: nar=${config.backends.nar.enabled} metta=${config.backends.metta.enabled}`
    );
  } catch (e) {
    console.log(`✗ invalid: ${(e as Error).message}`);
    process.exitCode = 1;
  }

  // Effective routing matrix: chain per task + resolved offline rung.
  try {
    const config = await loadConfig();
    if (config.routing) setRouting(config.routing as never);
    console.log('\n--- Routing matrix ---');
    const tasks: LMTask[] = ['quality', 'fast', 'structured'];
    for (const task of tasks) {
      const chain = getModelChain(resolveLMConfig().provider, task);
      console.log(`  ${task}: ${chain.join(' → ')}`);
    }
    const offline = resolveOfflineTier(resolveLMSettings());
    if (offline) console.log(`offline tier: ${offline}`);
    const routing = getRoutingStatus();
    if (routing.demoted.length) {
      console.log(`demoted: ${routing.demoted.map((d) => `${d.id} (${d.reason})`).join(', ')}`);
    }
  } catch {
    /* routing info is best-effort */
  }

  console.log('\nSee docs/tech/lm-config.md for the provider × tier × credential matrix.');

  // Circuit breaker status
  try {
    const settings = resolveLMSettings();
    const providers: LMProviderName[] = ['anthropic', 'openai', 'openai-compatible', 'ollama', 'transformers', 'mock'];
    console.log('\n--- Circuit breaker config (effective) ---');
    for (const p of providers) {
      const cfg = getEffectiveCircuitConfig(p, settings);
      const breaker = getCircuitBreaker(p);
      console.log(
        `  ${p}: threshold=${cfg.failureThreshold}, reset=${cfg.resetTimeoutMs}ms, success=${cfg.successThreshold} | state=${breaker.state}, failures=${breaker.consecutiveFailures}`
      );
    }
  } catch {
    /* circuit breaker info is best-effort */
  }
};

main().catch((err) => {
  createLogger({ scope: 'doctor' }).error('doctor failed', err as Error);
  process.exit(1);
});
