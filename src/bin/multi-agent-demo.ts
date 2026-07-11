#!/usr/bin/env tsx
/**
 * Multi-Agent SeNARS Demo
 * 
 * Demonstrates running NAR and MeTTa agents together via CognitiveCoordinator.
 * Both agents receive the same input and emit events through a shared bridge.
 */

import { MettaAgent } from '@senars/metta/agent';
import { createAgent } from '@senars/nar/agent';
import { SeNARSFactory } from '@senars/nar';
import { DEFAULT_NAR_CONFIG } from '@senars/nar';
import { CognitiveCoordinator } from '@senars/core/coordinator';
import { WSConnection } from '@senars/io/connections/ws';
import { CLIConnection } from '@senars/io/connections/cli';
import { createLogger } from '@senars/nar/logger';

const logger = createLogger({ scope: 'multi-agent-demo' });

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  SeNARS Multi-Agent Demo (NAR + MeTTa)                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Create NAR agent
  console.log('[NAR] Initializing...');
  const nar = SeNARSFactory.createDefault(DEFAULT_NAR_CONFIG);
  const narAgent = createAgent({ nar });
  narAgent.start();
  console.log('[NAR] Ready');

  // Create MeTTa agent
  console.log('[MeTTa] Initializing...');
  const mettaAgent = new MettaAgent();
  mettaAgent.start();
  console.log('[MeTTa] Ready');

  // Create coordinator that fans input to both agents
  const coordinator = new CognitiveCoordinator([narAgent, mettaAgent]);
  coordinator.start();
  console.log('[Coordinator] Ready - fanning input to both agents\n');

  // Register a test skill on MeTTa agent
  mettaAgent.registerSkill('echo', {
    name: 'echo',
    execute: async (msg: string) => `Echo: ${msg}`,
  });
  console.log('[MeTTa] Registered "echo" skill\n');

  // Set up WebSocket transport for coordinator
  const wsConfig = {
    id: 'ws-demo',
    enabled: true,
    type: 'websocket',
    config: { name: 'Multi-Agent WS', host: 'localhost', port: 8766 },
  };

  const wsConn = new WSConnection(wsConfig, {
    emit: (event, data) => logger.debug(`[WS] ${event}`, data),
    logger,
    getSessionSpaceId: () => 'demo',
  });

  coordinator.mount(wsConn);
  console.log('[WS] Server listening on ws://localhost:8766');

  // Set up CLI transport for interactive demo
  const cliConfig = {
    id: 'cli-demo',
    enabled: true,
    type: 'cli',
    config: { name: 'Multi-Agent CLI' },
  };

  const cliConn = new CLIConnection(cliConfig, {
    emit: () => {},
    logger,
    getSessionSpaceId: () => 'demo',
  });

  coordinator.mount(cliConn);
  console.log('[CLI] Ready for input\n');

  // Subscribe to events from both agents
  coordinator.on('*', (event) => {
    const engine = event.engine.toUpperCase();
    const type = event.type;
    const term = event.term?.slice(0, 80) ?? '';
    console.log(`  [${engine}] ${type}: ${term}`);
  });

  console.log('══════════════════════════════════════════════════════════════');
  console.log('Try sending messages via:');
  console.log('  - WebSocket: ws://localhost:8766');
  console.log('  - CLI: type in this terminal');
  console.log('Both agents will process each message!\n');
  console.log('Press Ctrl+C to exit');
  console.log('══════════════════════════════════════════════════════════════\n');

  // Keep running
  process.on('SIGINT', async () => {
    console.log('\n\nShutting down...');
    coordinator.stop();
    await wsConn.disconnect();
    await cliConn.disconnect();
    narAgent.stop();
    mettaAgent.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error('Demo failed', err as Error);
  process.exit(1);
});