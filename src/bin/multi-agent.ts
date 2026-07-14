#!/usr/bin/env tsx
/**
 * Multi-Agent SeNARS Demo (updated for Agent-as-Kernel architecture)
 *
 * Demonstrates running NAR and MeTTa reasoning backends inside a single Agent.
 * Input is routed to the appropriate backend based on capability matching.
 */

import { SeNARSFactory } from '@senars/nar';
import { createAgent } from '@senars/nar/agent';
import { NarBackend } from '@senars/nar/backend';
import { MettaBackend } from '@senars/metta/backend';
import { Agent } from '@senars/core';
import { DEFAULT_NAR_CONFIG } from '../config';
import { WSConnection } from '@senars/io/connections/ws';
import { CLIConnection } from '@senars/io/connections/cli';
import { createLogger } from '@senars/nar/logger';
import type { CognitiveEvent } from '@senars/core';

const logger = createLogger({ scope: 'multi-agent' });

async function main() {
  const agent = new Agent({ name: 'senars-multi' });

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

  agent.start();
  console.log(`[Agent] Ready — ${agent.getBackendIds().join(', ')} backends registered\n`);

  // Set up WebSocket transport
  const wsConfig = {
    id: 'ws-demo',
    enabled: true,
    type: 'websocket' as const,
    config: { name: 'Multi-Agent WS', host: 'localhost', port: 8766 },
  };

  const wsConn = new WSConnection(wsConfig, {
    emit: (event, data) => logger.debug(`[WS] ${event}`, data),
    logger,
    getSessionSpaceId: () => 'demo',
  });

  agent.mount(wsConn);
  console.log('[WS] Server listening on ws://localhost:8766');

  // Set up CLI transport for interactive demo
  const cliConfig = {
    id: 'cli-demo',
    enabled: true,
    type: 'cli' as const,
    config: { name: 'Multi-Agent CLI' },
  };

  const cliConn = new CLIConnection(cliConfig, {
    emit: () => {},
    logger,
    getSessionSpaceId: () => 'demo',
  });

  agent.mount(cliConn);
  console.log('[CLI] Ready for input\n');

  // Subscribe to events from agent
  agent.on('*', (event: CognitiveEvent) => {
    const engine = event.engine?.toUpperCase() ?? '?';
    const type = event.type;
    const term = event.term?.slice(0, 80) ?? '';
    console.log(`  [${engine}] ${type}: ${term}`);
  });

  console.log('══════════════════════════════════════════════════════════════');
  console.log('Try sending messages via:');
  console.log('  - WebSocket: ws://localhost:8766');
  console.log('  - CLI: type in this terminal');
  console.log('Agent routes to NAR or MeTTa based on input content.\n');
  console.log('Press Ctrl+C to exit');
  console.log('══════════════════════════════════════════════════════════════\n');

  // Keep running
  process.on('SIGINT', async () => {
    console.log('\n\nShutting down...');
    agent.stop();
    await wsConn.disconnect();
    await cliConn.disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error('Demo failed', err as Error);
  process.exit(1);
});
