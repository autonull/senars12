/**
 * MCP Server CLI Entry Point
 * Runs the SeNARS MCP Server with NAR tools registered
 * Uses official @modelcontextprotocol/sdk McpServer
 * Supports stdio, SSE, and Streamable HTTP transports
 */

import { createServer } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SeNARSFactory } from '@senars/nar';
import { createLogger } from '@senars/nar/logger';
import { registerMCPPrompts } from '../api/mcp-prompts.js';
import { registerMCPResources } from '../api/mcp-resources.js';
import { registerNARTools } from '../api/mcp-tools.js';
import { loadConfig } from '../config';
import { createAgentFromEnv } from './lib/lifecycle.js';

const logger = createLogger({ scope: 'mcp' });

const serverInfo = {
  name: 'senars-mcp',
  version: '1.0.0',
  description: 'SeNARS Non-Axiomatic Reasoning System MCP Server',
};

const server = new McpServer(serverInfo);

type TransportType = 'stdio' | 'sse' | 'http';

function getTransportType(): TransportType {
  const arg = process.argv.find((a) => a.startsWith('--transport='));
  if (arg) return arg.split('=')[1] as TransportType;
  return (process.env.MCP_TRANSPORT as TransportType) ?? 'stdio';
}

function getHttpPort(): number {
  const arg = process.argv.find((a) => a.startsWith('--port='));
  if (arg) return parseInt(arg.split('=')[1], 10);
  return parseInt(process.env.MCP_PORT ?? '8766', 10);
}

async function initialize() {
  const appConfig = await loadConfig();
  const nar = SeNARSFactory.createDefault(appConfig);
  const { agent } = await createAgentFromEnv();

  const context = { nar, agent };

  // Register tools, resources, and prompts using SDK's high-level API
  registerNARTools(server, nar, agent);
  registerMCPResources(server, context);
  registerMCPPrompts(server);

  const transportType = getTransportType();
  const port = getHttpPort();

  try {
    let transport;

    switch (transportType) {
      case 'stdio': {
        transport = new StdioServerTransport();
        await server.connect(transport);
        logger.info('SeNARS MCP Server started on stdio');
        break;
      }

      case 'sse': {
        // SSE transport requires HTTP server
        const sseTransport = new SSEServerTransport('/mcp/sse', createServer());
        await server.connect(sseTransport);
        logger.info('SeNARS MCP Server started with SSE transport');
        // Note: SSE requires external HTTP server to handle connections
        break;
      }

      case 'http': {
        const httpTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => `session-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        });
        await server.connect(httpTransport);

        const httpServer = createServer(async (req: any, res: any) => {
          if (req.url?.startsWith('/mcp')) {
            await httpTransport.handleRequest(req, res);
          } else {
            res.writeHead(404);
            res.end('Not found');
          }
        });

        httpServer.listen(port, () => {
          logger.info(
            `SeNARS MCP Server started on Streamable HTTP at http://localhost:${port}/mcp`
          );
        });

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
          logger.info('Shutting down HTTP server...');
          await httpTransport.close();
          httpServer.close();
          process.exit(0);
        });
        process.on('SIGTERM', async () => {
          logger.info('Shutting down HTTP server...');
          await httpTransport.close();
          httpServer.close();
          process.exit(0);
        });

        return; // Don't exit - server runs until killed
      }

      default:
        throw new Error(`Unknown transport: ${transportType}`);
    }

    logger.info('SeNARS MCP Server started successfully');
  } catch (error) {
    logger.error('Failed to start MCP server', error as Error);
    process.exit(1);
  }
}

initialize().catch((err) => {
  logger.error('Failed to initialize MCP server', err as Error);
  process.exit(1);
});

// For stdio transport, handle signals
if (getTransportType() === 'stdio') {
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
}
