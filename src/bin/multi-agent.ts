#!/usr/bin/env tsx
/**
 * Multi-Agent SeNARS Demo — NAR + MeTTa reasoning via one agent.
 * Uses createAgent() as the hub. Input routes to NAR (Narsese) or LM (NL).
 */

import { SeNARSFactory } from '@senars/nar';
import { createAgent } from '@senars/nar/agent';
import { WSConnection } from '@senars/io/connections/ws';
import { CLIConnection } from '@senars/io/connections/cli';
import { createLogger } from '@senars/nar/logger';

const logger = createLogger({ scope: 'multi-agent' });

async function main() {
  console.log('[NAR] Initializing...');
  const nar = SeNARSFactory.createForTesting({ core: { maxConcepts: 100 } });
  const agent = await createAgent({ nar });

  console.log('[NAR] Ready — NAR + MeTTa reasoning via one agent');
  await agent.start();
  console.log('[Agent] Ready');

  // Set up WebSocket transport
  const wsConfig = {
    id: 'ws-demo',
    enabled: true,
    type: 'websocket' as const,
    config: { name: 'Multi-Agent WS', host: 'localhost', port: 8766 },
  };

  const wsConn = new WSConnection(wsConfig, {
    emit: (event: string, data: unknown) => logger.debug(`[WS] ${event}`, data as Record<string, unknown>),
    logger,
    getSessionSpaceId: () => 'demo',
  });

  wsConn.onMessage(async (msg: { text: string }) => {
    const response = await agent.chat(msg.text);
    wsConn.send('default', response).catch(() => {});
  });
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

  cliConn.onMessage(async (msg: { text: string }) => {
    const response = await agent.chat(msg.text);
    console.log(`[Agent] ${response}`);
  });
  console.log('[CLI] Ready for input\n');

  console.log('══════════════════════════════════════════════════════════════');
  console.log('Try sending messages via:');
  console.log('  - WebSocket: ws://localhost:8766');
  console.log('  - CLI: type in this terminal');
  console.log('Narsese input routes to NAR, NL to LM.\n');
  console.log('Press Ctrl+C to exit');
  console.log('══════════════════════════════════════════════════════════════\n');

  process.on('SIGINT', async () => {
    console.log('\n\nShutting down...');
    await agent.stop();
    await wsConn.disconnect();
    await cliConn.disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error('Demo failed', err as Error);
  process.exit(1);
});
