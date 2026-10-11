#!/usr/bin/env tsx
/**
 * Agent test server for Playwright E2E tests.
 * Creates a NAR engine + Agent and starts the UI server.
 * Usage: tsx ui/tests/scripts/agent-server.ts [port]
 *
 * Deterministic by default: seeded id source, RNG and clock make a run's graph
 * JSON, sequence numbers and timestamps reproducible (Phase 1). Set
 * `SENARS_SEED=off` to fall back to ambient `crypto`/`Math.random`/`Date`.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Agent, InMemoryEventLog } from '@senars/core';
import { DEFAULT_CONFIG, NAR } from '@senars/nar';
import { NAREngine } from '@senars/nar/engine/NAREngine';
import { createLMService, createSeNARSRegistry } from '@senars/nar/lm';
import { fixedClock, SeededRNG, sequentialIdSource } from '@senars/util';
import { loadScenario, SCENARIOS } from '@senars/ui/scenarios';
import { startAgentUI } from '@senars/ui/server';

const FIXED_CLOCK_START = 1_700_000_000_000;

const repoRoot = resolve(import.meta.dirname, '../..');
const DEFAULT_GGUF = 'Qwen3.5-0.8B-Q4_0.gguf';

/**
 * Point the engine at the repo's compact GGUF when nothing else is configured,
 * so the dev/test server runs the offline provider out of the box (the server's
 * cwd is `ui/`, so the config's repo-relative path would not resolve).
 */
function defaultOfflineEnv(): void {
  if (!process.env.LM_LLAMACPP_MODEL) {
    const model = join(repoRoot, '.models', DEFAULT_GGUF);
    if (existsSync(model)) process.env.LM_LLAMACPP_MODEL = model;
  }
  if (!process.env.LM_PROVIDER && process.env.LM_LLAMACPP_MODEL) {
    process.env.LM_PROVIDER = 'llamacpp-embedded';
  }
}

function narConfig() {
  const seed = Number(process.env.SENARS_SEED ?? 1);
  if (process.env.SENARS_SEED === 'off') return DEFAULT_CONFIG;
  return {
    ...DEFAULT_CONFIG,
    ids: sequentialIdSource(),
    rng: new SeededRNG(seed),
    clock: fixedClock(FIXED_CLOCK_START),
  };
}

async function main(): Promise<void> {
  defaultOfflineEnv();
  const agent = new Agent({ id: 'playwright-agent', log: new InMemoryEventLog() });

  // NAREngine needs #emitCognitive for the event bridge to produce derivations.
  // The provider registry + LM service give the engine a live LM (offline by default).
  const nar = new NAR({
    ...narConfig(),
    providerRegistry: createSeNARSRegistry(),
    lmService: createLMService(),
  });
  const narEngine = new NAREngine(nar, agent.emitCognitive.bind(agent));
  agent.registerEngine('nar', narEngine);
  await agent.start();

  const port = process.argv[2] ? Number(process.argv[2]) : 0;
  const server = await startAgentUI(agent, { port });

  // Seed the bootstrap scenario AFTER the server is up so the projection's
  // `agent.on('*')` listener captures every event. Loading goes through the real
  // engine, not a synthetic injector.
  await loadScenario(nar, SCENARIOS.bootstrap);

  const addr = server.address();
  console.log(`AGENT_SERVER_READY port=${addr.port}`);

  process.on('SIGINT', async () => {
    await server.close();
    await agent.stop();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await server.close();
    await agent.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Failed to start agent server:', err);
  process.exit(1);
});
