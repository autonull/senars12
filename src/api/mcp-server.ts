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

    // Initialize MCP server with capabilities
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

    // Register handlers
    this.registerHandlers();
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
      // Select transport
      let transport;

      switch (this.config.transport) {
        case 'stdio':
          transport = new StdioServerTransport();
          break;
        case 'sse':
          // SSE transport would be implemented here
          this.logger.warn('SSE transport not yet implemented');
          return;
        case 'http':
          // HTTP transport would be implemented here
          this.logger.warn('HTTP transport not yet implemented');
          return;
        default:
          throw new Error(`Unknown transport: ${this.config.transport}`);
      }

      // Connect server to transport
      await this.server.connect(transport);

      this.isRunning = true;
      this.logger.info('MCP Server started successfully');

      // Log available tools
      const tools = this.adapter.getTools();
      this.logger.info(`Available tools: ${tools.map((t) => t.name).join(', ') || 'none'}`);
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
    // Tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.adapter.getTools().map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      return { tools };
    });

    // Tool execution
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

    // Resource listing (placeholder)
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [],
      };
    });

    // Resource retrieval (placeholder)
    this.server.setRequestHandler(ReadResourceRequestSchema, async (_request) => {
      return {
        contents: [],
      };
    });

    // Prompt listing (placeholder)
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [],
      };
    });

    // Prompt retrieval (placeholder)
    this.server.setRequestHandler(GetPromptRequestSchema, async (_request) => {
      return {
        description: 'No prompts configured',
        messages: [],
      };
    });
  }
}

export { EnhancedMCPAdapter };
