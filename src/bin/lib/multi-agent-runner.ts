#!/usr/bin/env tsx
/**
 * Shared multi-agent runner — parameterized for multi-agent.ts and multi-agent-demo.ts
 */

import { CLIConnection } from '@senars/io/connections/cli';
import { WSConnection } from '@senars/io/connections/ws';
import { createLogger } from '@senars/nar/logger';
import type { WiredNAR } from '@senars/nar/agent/builder';

export interface MultiAgentRunnerOptions {
  scope: string;
  banner: string[];
  createWired: () => Promise<WiredNAR>;
}

export async function runMultiAgent(opts: MultiAgentRunnerOptions): Promise<void> {
  const logger = createLogger({ scope: opts.scope });

  for (const line of opts.banner) {
    console.log(line);
  }

  console.log('[NAR] Initializing...');
  const wired = await opts.createWired();
  const { agent } = wired;

  console.log('[NAR] Ready — NAR + MeTTa reasoning via one agent');
  await agent.start();
  console.log('[Agent] Ready');

  const wsConfig = {
    id: 'ws-demo',
    enabled: true,
    type: 'websocket' as const,
    config: { name: 'Multi-Agent WS', host: 'localhost', port: 8766 },
  };

  const wsConn = new WSConnection(wsConfig, {
    emit: (event: string, data: unknown) =>
      logger.debug(`[WS] ${event}`, data as Record<string, unknown>),
    logger,
    getSessionSpaceId: () => 'demo',
  });

  wsConn.onMessage(async (msg: { text: string }) => {
    let response = '';
    for await (const evt of agent.chat(msg.text)) {
      if (evt.kind === 'text-delta') wsConn.send('default', evt.text).catch(() => {});
      if (evt.kind === 'finish') response = evt.text;
    }
    if (response) wsConn.send('default', response).catch(() => {});
  });
  console.log('[WS] Server listening on ws://localhost:8766');

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
    for await (const evt of agent.chat(msg.text)) {
      if (evt.kind === 'text-delta' || evt.kind === 'finish') console.log(`[Agent] ${evt.text}`);
    }
  });
  console.log('[CLI] Ready for input\n');

  console.log('══════════════════════════════════════════════════════════════');
  console.log('Try sending messages via:');
  console.log('  - WebSocket: ws://localhost:8766');
  console.log('  - CLI: type in this terminal');
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
