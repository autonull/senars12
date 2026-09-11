/**
 * MCP Server CLI Entry Point
 * Runs the SeNARS MCP Server with NAR tools registered
 * Supports stdio, SSE, and Streamable HTTP transports
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createLogger } from '@senars/nar/logger';
import { registerMCPPrompts } from '../api/mcp-prompts.js';
import { registerMCPResources } from '../api/mcp-resources.js';
import { registerNARTools } from '../api/mcp-tools.js';
import { createAgentFromEnv } from './lib/lifecycle.js';

const logger = createLogger({ scope: 'mcp' });

const serverInfo = {
  name: 'senars-mcp',
  version: '1.0.0',
  description: 'SeNARS Non-Axiomatic Reasoning System MCP Server',
};

const server = new McpServer(serverInfo);

type TransportType = 'stdio' | 'sse' | 'http';

const getTransportType = (): TransportType => {
  const arg = process.argv.find((a) => a.startsWith('--transport='));
  if (arg) return arg.split('=')[1] as TransportType;
  return (process.env.MCP_TRANSPORT as TransportType) ?? 'stdio';
};

const getHttpPort = (): number => {
  const arg = process.argv.find((a) => a.startsWith('--port='));
  if (arg) return parseInt(arg.split('=')[1], 10);
  return parseInt(process.env.MCP_PORT ?? '8766', 10);
};

const installSignalShutdown = (onShutdown: () => Promise<void>): void => {
  const handler = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);
    await onShutdown();
    process.exit(0);
  };
  process.on('SIGINT', () => handler('SIGINT'));
  process.on('SIGTERM', () => handler('SIGTERM'));
};

const startSse = (port: number): void => {
  const sessions = new Map<string, SSEServerTransport>();

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    if (req.method === 'GET' && url.pathname === '/mcp/sse') {
      const transport = new SSEServerTransport('/mcp/messages', res);
      sessions.set(transport.sessionId, transport);
      res.on('close', () => sessions.delete(transport.sessionId));
      await server.connect(transport);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/mcp/messages') {
      const sessionId = url.searchParams.get('sessionId');
      const transport = sessionId ? sessions.get(sessionId) : undefined;
      if (!transport) {
        res.writeHead(404).end('Unknown session');
        return;
      }
      await transport.handlePostMessage(req, res);
      return;
    }
    res.writeHead(404).end('Not found');
  });

  httpServer.listen(port, () => {
    logger.info(`SeNARS MCP Server started with SSE at http://localhost:${port}/mcp/sse`);
  });
  installSignalShutdown(async () => httpServer.close());
};

const startHttp = (port: number): void => {
  const httpTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => `session-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  });
  void server.connect(httpTransport);

  const httpServer = createServer(async (req, res) => {
    if (req.url?.startsWith('/mcp')) {
      await httpTransport.handleRequest(req, res);
    } else {
      res.writeHead(404).end('Not found');
    }
  });

  httpServer.listen(port, () => {
    logger.info(`SeNARS MCP Server started on Streamable HTTP at http://localhost:${port}/mcp`);
  });
  installSignalShutdown(async () => {
    await httpTransport.close();
    httpServer.close();
  });
};

async function initialize() {
  // Single shared NAR/agent instance — MCP tools, resources and the agent
  // all operate on the same cognitive core.
  const { nar, agent } = await createAgentFromEnv();

  registerNARTools(server, nar, agent);
  registerMCPResources(server, { nar, agent });
  registerMCPPrompts(server);

  const transportType = getTransportType();
  const port = getHttpPort();

  switch (transportType) {
    case 'stdio': {
      const transport = new StdioServerTransport();
      await server.connect(transport);
      logger.info('SeNARS MCP Server started on stdio');
      installSignalShutdown(async () => server.close());
      break;
    }
    case 'sse':
      startSse(port);
      break;
    case 'http':
      startHttp(port);
      break;
    default:
      throw new Error(`Unknown transport: ${transportType}`);
  }
}

initialize().catch((err) => {
  logger.error('Failed to initialize MCP server', err as Error);
  process.exit(1);
});
