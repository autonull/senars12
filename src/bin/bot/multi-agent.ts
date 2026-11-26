/**
 * Multi-agent demo entry point — extracted from bot/index.ts.
 */

import type { WiredNAR } from '@senars/agent';
import { NARBuilder } from '@senars/agent';
import { mettaPort } from '../lib/metta';
import { createLogger } from '@senars/util/logger';
import { setupGracefulShutdown } from '@senars/util/shutdown';
import { parseFlags } from '@senars/util/cli';
import { WSConnection, CLIConnection } from '@senars/io';
import type { Connection } from '@senars/io';

interface MultiAgentRunnerOptions {
  scope: string;
  banner: string[];
  createWired: () => Promise<WiredNAR>;
}

const runMultiAgent = async (opts: MultiAgentRunnerOptions): Promise<void> => {
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
    emit: (event: string, data: unknown) => logger.debug(`[WS] ${event}`, data as Record<string, unknown>),
    logger,
    getSessionSpaceId: () => 'demo',
  });

  wsConn.onMessage(async (msg: { text: string }) => {
    let response = '';
    for await (const evt of agent.chat(msg.text)) {
      if (evt.kind === 'text-delta' && evt.text) wsConn.send('default', evt.text).catch(() => {});
      if (evt.kind === 'finish') response = evt.text ?? '';
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

  const cliConn = new CLIConnection(cliConfig, { emit: () => {}, logger, getSessionSpaceId: () => 'demo' });

  cliConn.onMessage(async (msg: { text: string }) => {
    for await (const evt of agent.chat(msg.text)) {
      if ((evt.kind === 'text-delta' || evt.kind === 'finish') && evt.text) console.log(`[Agent] ${evt.text}`);
    }
  });
  console.log('[CLI] Ready for input\n');

  console.log('════════════════════════════════════════════════════════════════');
  console.log('Try sending messages via:');
  console.log('  - WebSocket: ws://localhost:8766');
  console.log('  - CLI: type in this terminal');
  console.log('Press Ctrl+C to exit');
  console.log('════════════════════════════════════════════════════════════════\n');

  setupGracefulShutdown(
    async () => {
      await agent.stop();
      await wsConn.disconnect();
      await cliConn.disconnect();
    },
    { info: (msg) => console.log(msg) }
  );
};

export const runMultiAgentEntry = async (): Promise<void> => {
  const testing = parseFlags().has('--testing');
  const banner = testing
    ? ['[NAR] Initializing...']
    : [
        '╔═══════════════════════════════════════════════════════════════╗',
        '║  SeNARS Multi-Agent Demo (NAR + MeTTa)                       ║',
        '╚═══════════════════════════════════════════════════════════════╝',
        '',
      ];

  await runMultiAgent({
    scope: testing ? 'multi-agent-testing' : 'multi-agent',
    banner,
    createWired: async () =>
      NARBuilder.fromProfile('arcade')
        .withNarConfig({
          maxConcepts: testing ? 100 : 100,
          activationDecayRate: testing ? 0 : undefined,
          consolidationInterval: testing ? 1000 : undefined,
          cpuThrottleMs: testing ? 0 : undefined,
          maxDerivationDepth: testing ? 20 : undefined,
        })
        .withMetta(mettaPort())
        .build(),
  });
};