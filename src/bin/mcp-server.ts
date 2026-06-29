/**
 * MCP Server CLI Entry Point
 * Runs the SeNARS MCP Server with NAR tools registered
 */

import { z } from 'zod';
import { createAgent } from '../../agent/src';
import { createNAR } from '../../nar/src';
import { SeNARSMCPServer } from '../api/mcp-server.js';
import { registerAgentAPI, registerNARToolsAsMCP } from '../api/mcp-tools.js';
import { loadConfig } from '../config';

const config = {
  name: 'senars-mcp',
  version: '1.0.0',
  transport: 'stdio' as const,
};

const server = new SeNARSMCPServer(config);

// Initialize NAR and Agent for tool registration
async function initialize() {
  const appConfig = await loadConfig();
  const nar = await createNAR(appConfig);
  const agent = createAgent({ nar });

  // Register NAR tools
  registerNARToolsAsMCP(nar, server.getAdapter());
  // Register Agent API tools
  registerAgentAPI(agent, server.getAdapter());

  // Register legacy tools
  const registry = server.getAdapter()['registry'];
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
  console.error('SeNARS MCP Server started on stdio');
  console.error(
    'Tools registered:',
    server
      .getAdapter()
      .getTools()
      .map((t) => t.name)
      .join(', ')
  );
}

initialize().catch((err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('Shutting down...');
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('Shutting down...');
  await server.stop();
  process.exit(0);
});
