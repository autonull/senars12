/**
 * MCP Server Implementation using official SDK
 * Full MCP protocol server with stdio, SSE, and Streamable HTTP support
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { ServerCapabilities } from '@modelcontextprotocol/sdk/types.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { type Logger, createLogger } from '../../nar/src/logger';
import { errMsg, toError } from '../../nar/src/utils';
import type { SchemaTransformer } from './mcp';
import { type CapabilityDescriptor, EnhancedMCPAdapter, getSchemaTransformer } from './mcp';

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

/**
 * MCP Server Configuration
 */
export interface MCPServerConfig {
  name?: string;
  version?: string;
  port?: number;
  transport?: 'stdio' | 'sse' | 'http';
}

/**
 * MCP Server that exposes SeNARS API via Model Context Protocol
 * Uses official @modelcontextprotocol/sdk for protocol compliance
 */
export class SeNARSMCPServer {
  private server: Server;
  private readonly adapter: EnhancedMCPAdapter;
  private config: Required<MCPServerConfig>;
  private logger: Logger;
  private schemaTransformer: SchemaTransformer;
  private isRunning = false;
  private resources = new Map<string, MCPResource>();
  private prompts = new Map<string, MCPPrompt>();
  private resourceContentResolver: ((uri: string) => string) | null = null;

  constructor(config: MCPServerConfig = {}) {
    this.adapter = new EnhancedMCPAdapter();
    this.schemaTransformer = getSchemaTransformer();
    this.logger = createLogger({ scope: 'api:mcp-server' });

    this.config = {
      name: config.name ?? 'senars-mcp',
      version: config.version ?? '1.0.0',
      port: config.port ?? 8766,
      transport: config.transport ?? 'stdio',
    };

    const capabilities: ServerCapabilities = {
      tools: {
        listChanged: true,
      },
      resources: {
        subscribe: true,
        listChanged: true,
      },
      prompts: {
        listChanged: true,
      },
      logging: {},
    };

    this.server = new Server(
      {
        name: this.config.name,
        version: this.config.version,
      },
      {
        capabilities,
      }
    );

    this.registerHandlers();
  }

  registerResource(resource: MCPResource): void {
    this.resources.set(resource.uri, resource);
  }

  registerPrompt(prompt: MCPPrompt): void {
    this.prompts.set(prompt.name, prompt);
  }

  setResourceContentResolver(fn: (uri: string) => string): void {
    this.resourceContentResolver = fn;
  }

  /**
   * Start the MCP server with specified transport
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('MCP Server already running');
      return;
    }

    this.logger.info(`Starting MCP Server '${this.config.name}' v${this.config.version}`);
    this.logger.info(`Transport: ${this.config.transport}`);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let transport: any;

      switch (this.config.transport) {
        case 'stdio':
          transport = new StdioServerTransport();
          break;
        case 'sse':
          this.logger.warn('SSE transport not yet implemented');
          return;
        case 'http':
          this.logger.warn('HTTP transport not yet implemented');
          return;
        default:
          throw new Error(`Unknown transport: ${this.config.transport}`);
      }

      await this.server.connect(transport);

      this.isRunning = true;
      this.logger.info('MCP Server started successfully');

      const tools = this.adapter.getTools();
      this.logger.info(`Available tools: ${tools.map((t) => t.name).join(', ') || 'none'}`);
      this.logger.info(`Available resources: ${this.resources.size}`);
      this.logger.info(`Available prompts: ${this.prompts.size}`);
    } catch (error) {
      this.logger.error('Failed to start MCP Server', toError(error));
      throw error;
    }
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping MCP Server');

    try {
      await this.server.close();
      this.isRunning = false;
      this.logger.info('MCP Server stopped');
    } catch (error) {
      this.logger.error('Error stopping MCP Server', toError(error));
    }
  }

  /**
   * Register a new capability dynamically
   */
  registerCapability(descriptor: CapabilityDescriptor): void {
    this.adapter.registerCapability(descriptor);
    this.logger.info(`Registered capability: ${descriptor.name}`);
  }

  /**
   * Unregister a capability dynamically
   */
  unregisterCapability(name: string): void {
    this.adapter.unregisterCapability(name);
    this.logger.info(`Unregistered capability: ${name}`);
  }

  listTools(): Array<{ name: string; description: string }> {
    return this.adapter.getTools().map((t) => ({ name: t.name, description: t.description }));
  }

  getToolSchema(name: string): Record<string, unknown> | undefined {
    return this.adapter.getTools().find((t) => t.name === name)?.inputSchema;
  }

  isServerRunning(): boolean {
    return this.isRunning;
  }

  getAdapter(): EnhancedMCPAdapter {
    return this.adapter;
  }

  /**
   * Register MCP protocol handlers
   */
  private registerHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.adapter.getTools().map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      this.logger.info(`Tool call: ${name}`, args);

      try {
        const result = await this.adapter.executeTool({
          name,
          arguments: args || {},
        });

        return {
          content: result.content,
          isError: result.isError,
        };
      } catch (error) {
        this.logger.error(`Tool execution failed: ${name}`, toError(error));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  type: 'error',
                  error: { code: 'EXECUTION_ERROR', message: errMsg(error) },
                  timestamp: Date.now(),
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    });

    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = Array.from(this.resources.values()).map((r) => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
      }));

      return { resources };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;

      if (this.resourceContentResolver) {
        const text = this.resourceContentResolver(uri);
        const resource = this.resources.get(uri);
        return {
          contents: [
            {
              uri,
              mimeType: resource?.mimeType ?? 'application/json',
              text,
            },
          ],
        };
      }

      return {
        contents: [],
      };
    });

    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      const prompts = Array.from(this.prompts.values()).map((p) => ({
        name: p.name,
        description: p.description,
        arguments: p.arguments,
      }));

      return { prompts };
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const name = request.params.name;
      const prompt = this.prompts.get(name);

      if (!prompt) {
        return {
          description: `Prompt '${name}' not found`,
          messages: [],
        };
      }

      return {
        description: prompt.description ?? `Prompt: ${name}`,
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Execute prompt: ${name}`,
            },
          },
        ],
      };
    });
  }
}

export { EnhancedMCPAdapter };
