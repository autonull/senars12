#!/usr/bin/env tsx
/**
 * SeNARS Bot - Multi-connection agent.
 *
 * Default config: connects to irc.libera.chat#senars as `senars-bot`
 * and starts a WebSocket server on 8765. Set ENABLE_HTTP=true or
 * ENABLE_MCP=true to opt in to additional transports.
 */

import { mkdir } from 'node:fs/promises';
import {
  AuthManager,
  bindAgentToConnection,
  CLIConnection,
  CommandRegistry,
  ConnectionManager,
  createConnectionConfigsFromEnv,
  HTTPConnection,
  IRCConnection,
  MCPConnection,
  WSConnection,
} from '@senars/io';
import { resolveLMConfig } from '@senars/nar/lm';
import { createLogger } from '@senars/nar/logger';
import { assertValidEnv } from '../utils/env-validate.js';
import { readAuthConfig } from './lib/env-config.js';
import { createAgentFromEnv, setupGracefulShutdown } from './lib/lifecycle.js';

assertValidEnv();

const logger = createLogger({ scope: 'bot' });

async function main(): Promise<void> {
  await mkdir('.cache/sessions', { recursive: true }).catch(() => undefined);
  const { agent, sessionManager, episodicMemory } = await createAgentFromEnv();
  const lmConfig = resolveLMConfig();

  const authCfg = readAuthConfig();
  const auth = new AuthManager();
  if (authCfg.secret) {
    for (const connId of authCfg.connectionIds) {
      auth.setSecret(connId, authCfg.secret);
    }
  }

  const commandRegistry = new CommandRegistry();

  const cm = new ConnectionManager();
  cm.registerFactory({
    type: 'cli',
    create: (cfg) => new CLIConnection(cfg, { emit: () => undefined, logger }),
  });
  cm.registerFactory({
    type: 'irc',
    create: (cfg) => new IRCConnection(cfg, { emit: () => undefined, logger }),
  });
  cm.registerFactory({
    type: 'websocket',
    create: (cfg) => new WSConnection(cfg, { emit: () => undefined, logger }),
  });
  cm.registerFactory({
    type: 'http',
    create: (cfg) => new HTTPConnection(cfg, { emit: () => undefined, logger }),
  });
  cm.registerFactory({
    type: 'mcp',
    create: (cfg) => new MCPConnection(cfg, { emit: () => undefined, logger }),
  });

  const configs = createConnectionConfigsFromEnv();
  logger.info(
    `Configured connections: ${
      configs.map((c: { type: string; id: string }) => `${c.type}:${c.id}`).join(', ') || '(none)'
    }`
  );

  for (const cfg of configs) {
    try {
      const conn = await cm.addConnection(
        cfg as unknown as import('@senars/core').ConnectionConfig,
        { emit: () => undefined, logger }
      );
      bindAgentToConnection(agent, conn, {
        auth,
        commandRegistry,
        sessionManager,
        episodicMemory,
      });
      logger.info(`Bound bridge to: ${conn.name} (${conn.type})`);
    } catch (e) {
      logger.error(`Failed to add ${cfg.type}: ${(e as Error).message}`);
    }
  }

  await agent.start();

  if (process.env.ENABLE_WEB_UI) {
    const { startAgentUI } = await import('../../ui/src/server/index.js');
    startAgentUI(agent).catch((err) => {
      logger.error('Web UI failed to start', err as Error);
    });
  }

  setupGracefulShutdown(async () => {
    logger.info('Shutting down...');
    await sessionManager.snapshot();
    await sessionManager.close();
    await agent.stop();
    await cm.shutdownAll();
    logger.info('Bot stopped');
  }, logger);

  logger.info(`Bot ready: ${configs.length} connection(s)`);
  logger.info(`LM: ${lmConfig.provider} ${lmConfig.model}`);
  logger.info('Try: IRC senars.libera.chat #senars, or ws://localhost:8765');
}

main().catch((err) => {
  logger.error('Bot failed to start', err as Error);
  process.exit(1);
});
