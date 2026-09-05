/**
 * MCP Server CLI Entry Point
 * Runs the SeNARS MCP Server with NAR tools registered
 * Uses official @modelcontextprotocol/sdk McpServer
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SeNARSFactory } from '@senars/nar';
import { createLogger } from '@senars/nar/logger';
import { loadConfig } from '../config';
import { createAgentFromEnv } from './lib/lifecycle.js';
import { registerNARTools } from '../api/mcp-tools.js';
import { registerMCPResources } from '../api/mcp-resources.js';
import { registerMCPPrompts } from '../api/mcp-prompts.js';

const logger = createLogger({ scope: 'mcp' });

const serverInfo = {
  name: 'senars-mcp',
  version: '1.0.0',
  description: 'SeNARS Non-Axiomatic Reasoning System MCP Server',
};

const server = new McpServer(serverInfo);

async function initialize() {
  const appConfig = await loadConfig();
  const nar = SeNARSFactory.createDefault(appConfig);
  const { agent } = await createAgentFromEnv();

  const context = { nar, agent };

  // Register tools, resources, and prompts using SDK's high-level API
  registerNARTools(server, nar, agent);
  registerMCPResources(server, context);
  registerMCPPrompts(server);

  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info('SeNARS MCP Server started on stdio');
  } catch (error) {
    logger.error('Failed to start MCP server', error as Error);
    process.exit(1);
  }
}

initialize().catch((err) => {
  logger.error('Failed to initialize MCP server', err as Error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  await server.close();
  process.exit(0);
});