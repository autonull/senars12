#!/usr/bin/env tsx
/**
 * SeNARS — Single-Process Entry Point
 *
 * Starts Agent + NAR backend + MeTTa backend + UI server in one process.
 * The UI serves the graph viewport and WebSocket for real-time cognitive events.
 *
 * Usage: pnpm senars [--port PORT] [--no-bootstrap]
 */

import { Agent, bootstrapAgent } from '@senars/core';
import { SeNARSFactory } from '@senars/nar';
import { createAgent } from '@senars/nar/agent';
import { NarBackend } from '@senars/nar/backend';
import { MettaBackend } from '@senars/metta/backend';
import { startAgentUI } from '@senars/ui/server';
import { DEFAULT_NAR_CONFIG } from '../config';
import { createLogger } from '@senars/nar/logger';

const logger = createLogger({ scope: 'senars' });

async function main() {
  const port = Number.parseInt(process.argv.find((a) => a.startsWith('--port='))?.split('=')[1] ?? '0', 10) || 8765;
  const skipBootstrap = process.argv.includes('--no-bootstrap');

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  SeNARS — Agent-as-Kernel                                    ║');
  console.log('║  NAR symbolic reasoning + MeTTa pattern matching             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const agent = new Agent({ name: 'senars', persona: 'curious assistant' });

  // Register NAR backend
  console.log('[NAR] Initializing...');
  const nar = SeNARSFactory.createDefault({ ...DEFAULT_NAR_CONFIG, maxConcepts: 100 });
  const oldAgent = createAgent({ nar });
  const narBackend = new NarBackend(oldAgent);
  await agent.registerBackend(narBackend, {});
  console.log('[NAR] Ready');

  // Register MeTTa backend
  console.log('[MeTTa] Initializing...');
  const mettaBackend = new MettaBackend();
  await agent.registerBackend(mettaBackend, { metta: { maxRecursionDepth: 100 } });
  console.log('[MeTTa] Ready');

  // Bootstrap seed beliefs
  if (!skipBootstrap) {
    console.log('[Bootstrap] Loading seed beliefs...');
    await bootstrapAgent(agent);
    console.log('[Bootstrap] Done');
  }

  // Start UI server (HTTP + WebSocket + graph projection)
  console.log(`\n[UI] Starting on port ${port}...`);
  const server = await startAgentUI(agent, { port });

  const addr = server.address();
  console.log(`\n[Ready] Agent UI at http://localhost:${addr.port}`);
  console.log('  Connect via WebSocket or open in browser to see the graph.\n');

  process.on('SIGINT', async () => {
    console.log('\n\nShutting down...');
    await server.close();
    agent.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error('Failed to start', err as Error);
  process.exit(1);
});
