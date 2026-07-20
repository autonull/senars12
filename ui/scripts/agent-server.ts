#!/usr/bin/env tsx
/**
 * Agent test server for Playwright E2E tests.
 * Creates a NAR engine + Agent and starts the UI server.
 * Usage: tsx ui/tests/scripts/agent-server.ts [port]
 */
import { Agent, InMemoryEventLog } from '@senars/core';
import { NAREngine } from '@senars/nar/engine/NAREngine';
import { startAgentUI } from '@senars/ui/server';

// Bootstrap beliefs that produce visible graph nodes and edges.
// Each statement is valid Narsese that the parser and NAR engine can process.
const BOOTSTRAP_BELIEFS: string[] = [
  '<bird --> animal>.',
  '<robin --> bird>.',
  '<sky --> blue>.',
  '<cat --> mammal>.',
  '<dog --> mammal>.',
  '<fish --> animal>.',
];

async function main(): Promise<void> {
  // Create agent first so we can bind #emitCognitive to the NAREngine
  const agent = new Agent({ id: 'playwright-agent', log: new InMemoryEventLog() });

  // NAREngine needs #emitCognitive for the event bridge to produce derivations
  const narEngine = new NAREngine(undefined, agent.emitCognitive.bind(agent));
  agent.registerEngine('nar', narEngine);
  await agent.start();

  const port = process.argv[2] ? Number(process.argv[2]) : 0;
  const server = await startAgentUI(agent, { port });

  // Seed bootstrap beliefs AFTER server is up so the agent.on('*') listener
  // (registered inside startAgentUI → createServerWithProjection) captures
  // derivation.made events and populates the graph projection.
  // Using agent.chat() ensures the full cycle emits derivation.made events.
  for (const stmt of BOOTSTRAP_BELIEFS) {
    try {
      for await (const _evt of agent.chat(stmt)) {
        // consume events - derivation.made gets emitted by runCycle
      }
    } catch {
      // skip unparseable statements
    }
  }

  const addr = server.address();
  console.log(`AGENT_SERVER_READY port=${addr.port}`);

  // Graceful shutdown
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
