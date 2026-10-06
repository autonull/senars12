import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createLogger, errMsg } from '@senars/util';
import { withDefaults } from '@senars/util/config';
import type { ConnectionConfig, ConnectionDeps } from '../types.js';
import { BaseConnection } from './base.js';

export interface MCPToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export interface MCPToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface MCPOptions {
  name: string;
  transport: 'stdio' | 'sse' | 'http' | 'in-memory';
  command?: string;
  args?: string[];
  url?: string;
  inMemoryPair?: [unknown, unknown];
}

/** What this transport does when configured with nothing at all. */
const MCP_DEFAULTS: MCPOptions = { name: 'MCP', transport: 'stdio' };

export class MCPConnection extends BaseConnection {
  override readonly type = 'mcp';
  override readonly logger = createLogger({ scope: 'io:mcp' });
  private readonly transport: MCPOptions['transport'];
  private readonly options: Omit<MCPOptions, 'name' | 'transport'>;
  private client: Client | null = null;

  constructor(config: ConnectionConfig, deps: ConnectionDeps) {
    super(config, deps);
    const { name, transport, ...options } = withDefaults<MCPOptions>(config.config, MCP_DEFAULTS);
    this.name = name;
    this.transport = transport;
    this.options = options;
  }

  override async connect(): Promise<void> {
    await this.runConnect('MCP_CONNECT_ERROR', async () => {
      this.client = new Client({ name: 'senars-mcp-client', version: '1.0.0' });

      if (this.transport === 'stdio') {
        const { command, args = [] } = this.options;
        if (!command) throw new Error('MCP stdio transport requires command in config');
        await this.client.connect(new StdioClientTransport({ command, args }));
      } else if (this.transport === 'in-memory') {
        const { inMemoryPair: pair } = this.options;
        if (!pair) throw new Error('MCP in-memory transport requires inMemoryPair in config');
        await this.client.connect(pair[0] as never);
      } else {
        const { url } = this.options;
        if (!url) throw new Error('MCP sse/http transport requires url in config');
        await this.client.connect(
          this.transport === 'http'
            ? new StreamableHTTPClientTransport(new URL(url))
            : new SSEClientTransport(new URL(url))
        );
      }
    });
    this.logger.info(`MCP connection ${this.id} connected via ${this.transport}`);
  }

  override async disconnect(reason?: string): Promise<void> {
    await this.runDisconnect(async () => {
      await this.client?.close().catch(() => undefined);
      this.client = null;
    });
    this.logger.info(`MCP connection ${this.id} disconnected: ${reason ?? 'normal'}`);
  }

  async send(target: string, text: string): Promise<void> {
    const args = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    await this.callTool(target, args);
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    if (!this.client) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'MCP client not connected' }) }],
        isError: true,
      };
    }
    try {
      const result = await this.client.callTool({ name, arguments: args });
      const content = Array.isArray(result.content)
        ? result.content.map((c: unknown) => {
            const part = c as { type?: string; text?: string };
            return { type: part.type ?? 'text', text: part.text ?? JSON.stringify(c) };
          })
        : [{ type: 'text', text: JSON.stringify(result) }];
      return { content, isError: result.isError === true };
    } catch (e) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: errMsg(e) }) }],
        isError: true,
      };
    }
  }

  async getTools(): Promise<MCPToolInfo[]> {
    if (!this.client) return [];
    const { tools } = await this.client.listTools();
    return tools.map((t) => ({
      name: t.name,
      description: t.description ?? t.name,
      inputSchema: (t.inputSchema ?? {}) as Record<string, unknown>,
    }));
  }

  async importIntoRegistry(
    registry: {
      register: (
        name: string,
        def: {
          description: string;
          inputSchema: unknown;
          execute: (args: Record<string, unknown>) => Promise<unknown>;
        }
      ) => void;
    },
    prefix = 'mcp_'
  ): Promise<string[]> {
    const tools = await this.getTools();
    for (const t of tools) {
      registry.register(`${prefix}${t.name}`, {
        description: t.description,
        inputSchema: t.inputSchema,
        execute: async (args) => {
          const res = await this.callTool(t.name, args);
          return res.isError
            ? { error: res.content.map((c) => c.text).join('\n') }
            : res.content.map((c) => c.text).join('\n');
        },
      });
    }
    return tools.map((t) => `${prefix}${t.name}`);
  }
}
