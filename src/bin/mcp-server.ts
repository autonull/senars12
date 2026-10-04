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
import { DialogueCapture } from '@senars/nar/dialogue';
import {
  BoundedMap,
  createLogger,
  envStr,
  envStrOr,
  generateId,
  parseFlags,
  setupGracefulShutdown,
  type Teardown,
} from '@senars/util';
import { envNum } from '@senars/util/config';
import { runEntrypoint } from './lib/fatal-error.js';
import { HttpGuard, rejectWithStatus } from './lib/http-guards.js';
import { createAgentFromEnv } from './lib/lifecycle.js';
import { JobManager } from './lib/mcp/job-manager.js';
import { registerDialogueTools } from './lib/mcp/mcp-dialogue-tools.js';
import { registerMCPPrompts } from './lib/mcp/mcp-prompts.js';
import { registerMCPResources } from './lib/mcp/mcp-resources.js';
import { registerNARTools } from './lib/mcp/mcp-tools.js';

const logger = createLogger({ scope: 'mcp' });

const serverInfo = {
  name: 'senars-mcp',
  version: '1.0.0',
  description: 'SeNARS Non-Axiomatic Reasoning System MCP Server',
};

const server = new McpServer(serverInfo);

type TransportType = 'stdio' | 'sse' | 'http';

const flags = parseFlags();

const getTransportType = (): TransportType =>
  flags.str('--transport', envStrOr('stdio', 'MCP_TRANSPORT')) as TransportType;

/**
 * `flags.num` guards the flag it reads; guarding the *fallback* is the other
 * half. `Number(process.env.MCP_PORT ?? 8766)` is `NaN` for a mistyped
 * `MCP_PORT`, which `finiteOr` then dutifully passes through — so the flag
 * parser's own protection was bypassed by the default beside it.
 */
const getHttpPort = (): number => flags.num('--port', envNum('MCP_PORT', 8766));

/** Concurrent SSE sessions one HTTP transport keeps before recycling the least recently used. */
const MAX_SSE_SESSIONS = 64;

const startSse = (port: number, guard: HttpGuard): Teardown => {
  const sessions = new BoundedMap<string, SSEServerTransport>({
    maxSize: MAX_SSE_SESSIONS,
    eviction: 'lru',
  });

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    const rejected = guard.check(req, ['/mcp/sse']);
    if (rejected) {
      rejectWithStatus(res, rejected);
      return;
    }
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
  return async () => {
    await httpServer.close();
  };
};

const startHttp = (port: number, guard: HttpGuard): Teardown => {
  const httpTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => generateId('session'),
  });
  void server.connect(httpTransport);

  const httpServer = createServer(async (req, res) => {
    const rejected = guard.check(req);
    if (rejected) {
      rejectWithStatus(res, rejected);
      return;
    }
    if (req.url?.startsWith('/mcp')) {
      await httpTransport.handleRequest(req, res);
    } else {
      res.writeHead(404).end('Not found');
    }
  });

  httpServer.listen(port, () => {
    logger.info(`SeNARS MCP Server started on Streamable HTTP at http://localhost:${port}/mcp`);
  });
  return async () => {
    await httpTransport.close();
    await httpServer.close();
  };
};

async function initialize() {
  // Single shared NAR/agent instance — MCP tools, resources and the agent
  // all operate on the same cognitive core.
  const { nar, agent, appConfig, episodicMemory } = await createAgentFromEnv();
  const jobs = new JobManager();

  registerNARTools(server, nar, agent, { jobs, approval: appConfig.connections?.mcp?.approval });
  registerMCPResources(server, { nar, agent, jobs });
  registerMCPPrompts(server);

  // TODO24: Dialogue Flywheel tools (react/turns/retrospect) when enabled.
  if (appConfig.dialogue?.enabled) {
    registerDialogueTools(server, {
      dialogue: new DialogueCapture({
        episodic: episodicMemory,
        dataset: (nar as any).systemOne?.dataset,
        embeddingCache: nar.getSystemOneEmbeddingCache?.(),
        contrastive: nar.getSystemOneContrastive?.(),
        config: appConfig.dialogue,
      }),
      episodic: episodicMemory,
      traceGrades: (nar as any).systemOne?.traceGradeHistory,
    });
  }

  const transportType = getTransportType();
  const port = getHttpPort();
  // One signal handler for whichever transport started. The three branches used
  // to install their own, which meant the close path had to be written three
  // times and could not name a resource the branch that started it did not know.
  let closeTransport: Teardown;

  switch (transportType) {
    case 'stdio': {
      const transport = new StdioServerTransport();
      await server.connect(transport);
      logger.info('SeNARS MCP Server started on stdio');
      closeTransport = () => server.close();
      break;
    }
    case 'sse':
    case 'http': {
      const mcpConfig = appConfig.connections?.mcp;
      const apiKey = envStr(mcpConfig?.apiKeyEnv) ?? mcpConfig?.apiKey;
      const guard = new HttpGuard({ apiKey, rateLimitPerMinute: mcpConfig?.rateLimitPerMinute });
      if (!apiKey) logger.info(`MCP API key (client x-api-key header): ${guard.activeKey}`);
      closeTransport = transportType === 'sse' ? startSse(port, guard) : startHttp(port, guard);
      break;
    }
    default:
      throw new Error(`Unknown transport: ${transportType}`);
  }

  setupGracefulShutdown(async () => {
    await closeTransport();
  }, logger);
}

runEntrypoint(initialize);
