/**
 * MCP Server CLI Entry Point
 * Runs the SeNARS MCP Server with NAR tools registered
 */

import { SeNARSFactory } from '@senars/nar';
import { createLogger } from '@senars/nar/logger';
import { z } from 'zod';
import { SeNARSMCPServer } from '../api/mcp-server.js';
import { registerAgentAPI, registerNARToolsAsMCP } from '../api/mcp-tools.js';
import { loadConfig } from '../config';
import { createAgentFromEnv } from './lib/lifecycle.js';

const logger = createLogger({ scope: 'mcp' });

const config = {
  name: 'senars-mcp',
  version: '1.0.0',
  transport: 'stdio' as const,
};

const server = new SeNARSMCPServer(config);

async function initialize() {
  const appConfig = await loadConfig();
  const nar = SeNARSFactory.createDefault(appConfig);
  const { agent } = await createAgentFromEnv();

  registerNARToolsAsMCP(nar, server.getAdapter());
  registerAgentAPI(agent, server.getAdapter());

  const registry = (server.getAdapter() as Record<string, unknown>).registry;
  registry.register('get_beliefs', {
    description: 'Get all beliefs from NAR memory',
    params: z.object({}),
    returns: z.any(),
    handler: async () => nar.getBeliefs(),
  });

  registry.register('get_attention', {
    description: 'Get current attention snapshot',
    params: z.object({}),
    returns: z.any(),
    handler: async () => ({ attention: 'N/A' }),
  });

  await server.start();
  logger.info('SeNARS MCP Server started on stdio');
  const tools = server
    .getAdapter()
    .getTools()
    .map((t) => t.name)
    .join(', ');
  logger.info(`Tools registered: ${tools}`);
}

initialize().catch((err) => {
  logger.error('Failed to start MCP server', err as Error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  await server.stop();
  process.exit(0);
});
