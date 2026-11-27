/**
 * MCP Server transports and HTTP guards.
 * Extracted from mcp-server.ts for reuse and testing.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import { SlidingWindowRateLimiter } from '@senars/util/rate-limit';
import { BoundedMap } from '@senars/util/bounded-map';
import { generateId } from '@senars/util/id';
import type { Teardown } from '@senars/util/disposal';
import { envStrOr, envNum } from '@senars/util/config';

/** HTTP request guard with API key validation and rate limiting. */
export class HttpGuard {
  private readonly apiKeys = new Set<string>();
  private readonly rateLimiter: SlidingWindowRateLimiter;
  readonly rateLimitPerMinute: number;

  constructor(options: { apiKey?: string; rateLimitPerMinute?: number } = {}) {
    this.rateLimitPerMinute = options.rateLimitPerMinute ?? 30;
    this.rateLimiter = new SlidingWindowRateLimiter({
      limit: this.rateLimitPerMinute,
      windowMs: 60_000,
    });
    this.apiKeys.add(options.apiKey ?? randomBytes(32).toString('hex'));
  }

  check(req: IncomingMessage, exemptPaths: readonly string[] = []): number | null {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (exemptPaths.includes(url.pathname)) return null;

    const key = (req.headers['x-api-key'] as string | undefined) ?? '';
    if (!key || !this.apiKeys.has(key)) return 401;

    return this.rateLimiter.tryAcquire(key) ? null : 429;
  }

  get activeKey(): string {
    return this.apiKeys.values().next().value ?? '';
  }
}

const rejectWithStatus = (
  res: { writeHead: (code: number) => { end: (b?: string) => void } },
  status: number
): void => {
  const reason = status === 401 ? 'Unauthorized (missing or invalid x-api-key)' : 'Rate limit exceeded';
  res.writeHead(status).end(reason);
};

/** Start SSE transport server. */
export const startSse = (port: number, guard: HttpGuard, server: McpServer): Teardown => {
  const sessions = new BoundedMap<string, SSEServerTransport>({
    maxSize: 64,
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

  httpServer.listen(port);
  return async () => {
    await httpServer.close();
  };
};

/** Start Streamable HTTP transport server. */
export const startHttp = (port: number, guard: HttpGuard, server: McpServer): Teardown => {
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

  httpServer.listen(port);
  return async () => {
    await httpTransport.close();
    await httpServer.close();
  };
};

/** Start stdio transport. */
export const startStdio = async (server: McpServer): Promise<Teardown> => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return () => server.close();
};

/** Build MCP server with standard configuration. */
export function createMcpServer(): McpServer {
  return new McpServer({
    name: 'senars-mcp',
    version: '1.0.0',
    description: 'SeNARS Non-Axiomatic Reasoning System MCP Server',
  });
}

/** Get transport type from flags/env. */
export function getTransportType(flags: ReturnType<typeof import('@senars/util/cli').parseFlags>): 'stdio' | 'sse' | 'http' {
  return flags.str('--transport', envStrOr('stdio', 'MCP_TRANSPORT')) as 'stdio' | 'sse' | 'http';
}

/** Get HTTP port from flags/env. */
export function getHttpPort(flags: ReturnType<typeof import('@senars/util/cli').parseFlags>): number {
  return flags.num('--port', envNum('MCP_PORT', 8766));
}