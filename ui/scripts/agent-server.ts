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
import { Agent, InMemoryEventLog } from '@senars/core';
import { DEFAULT_CONFIG, NAR } from '@senars/nar';
import { NAREngine } from '@senars/nar/engine/NAREngine';
import { fixedClock, SeededRNG, sequentialIdSource } from '@senars/util';
import { loadScenario, SCENARIOS } from '@senars/ui/scenarios';
import { startAgentUI } from '@senars/ui/server';

const FIXED_CLOCK_START = 1_700_000_000_000;

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
  const agent = new Agent({ id: 'playwright-agent', log: new InMemoryEventLog() });

  // NAREngine needs #emitCognitive for the event bridge to produce derivations.
  const nar = new NAR(narConfig());
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
