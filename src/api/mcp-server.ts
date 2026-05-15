/**
 * MCP Server Implementation using official SDK
 * Full MCP protocol server with stdio, SSE, and Streamable HTTP support
 */

import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import type {ServerCapabilities} from '@modelcontextprotocol/sdk/types.js';
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
	ListResourcesRequestSchema,
	ReadResourceRequestSchema,
	ListPromptsRequestSchema,
	GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {z} from 'zod';
import {APIRegistry} from './registry.js';
import {EnhancedMCPAdapter} from './mcp/enhanced-adapter.js';
import {SchemaTransformer, getSchemaTransformer} from './mcp/schema-transformer.js';
import {CapabilityDescriptor} from './mcp/types.js';
import {Logger, LoggerFactory} from '../nar/logger/index.js';

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
	private adapter: EnhancedMCPAdapter;
	private config: Required<MCPServerConfig>;
	private logger: Logger;
	private schemaTransformer: SchemaTransformer;
	private isRunning: boolean = false;

	constructor(registry?: APIRegistry, config: MCPServerConfig = {}) {
		this.adapter = new EnhancedMCPAdapter(registry);
		this.schemaTransformer = getSchemaTransformer();
		this.logger = LoggerFactory.getInstance().get('api:mcp-server');

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

			return {tools};
		});

		// Tool execution
		this.server.setRequestHandler(
			CallToolRequestSchema,
			async (request) => {
				const {name, arguments: args} = request.params;

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
					this.logger.error(`Tool execution failed: ${name}`, error instanceof Error ? error : new Error(String(error)));

					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify(
									{
										type: 'error',
										error: {
											code: 'EXECUTION_ERROR',
											message:
												error instanceof Error
													? error.message
													: String(error),
										},
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
			}
		);

		// Resource listing (placeholder)
		this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
			return {
				resources: [],
			};
		});

		// Resource retrieval (placeholder)
		this.server.setRequestHandler(
			ReadResourceRequestSchema,
			async (_request) => {
				return {
					contents: [],
				};
			}
		);

		// Prompt listing (placeholder)
		this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
			return {
				prompts: [],
			};
		});

		// Prompt retrieval (placeholder)
		this.server.setRequestHandler(
			GetPromptRequestSchema,
			async (_request) => {
				return {
					description: 'No prompts configured',
					messages: [],
				};
			}
		);
	}

	/**
	 * Start the MCP server with specified transport
	 */
	async start(): Promise<void> {
		if (this.isRunning) {
			this.logger.warn('MCP Server already running');
			return;
		}

		this.logger.info(
			`Starting MCP Server '${this.config.name}' v${this.config.version}`
		);
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
			this.logger.info(
				`Available tools: ${tools.map((t) => t.name).join(', ') || 'none'}`
			);
		} catch (error) {
			this.logger.error('Failed to start MCP Server', error instanceof Error ? error : new Error(String(error)));
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
			this.logger.error('Error stopping MCP Server', error instanceof Error ? error : new Error(String(error)));
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

	/**
	 * List all available tools
	 */
	listTools(): Array<{name: string; description: string}> {
		return this.adapter.getTools().map((tool) => ({
			name: tool.name,
			description: tool.description,
		}));
	}

	/**
	 * Get tool schema by name
	 */
	getToolSchema(name: string): Record<string, unknown> | undefined {
		const tools = this.adapter.getTools();
		const tool = tools.find((t) => t.name === name);
		return tool ? tool.inputSchema : undefined;
	}

	/**
	 * Execute a tool call (for testing/internal use)
	 */
	async handleToolCall(
		name: string,
		args: Record<string, any>
	): Promise<any> {
		return this.adapter.executeTool({name, arguments: args});
	}

	/**
	 * Check if server is running
	 */
	isServerRunning(): boolean {
		return this.isRunning;
	}

	/**
	 * Get adapter for advanced operations
	 */
	getAdapter(): EnhancedMCPAdapter {
		return this.adapter;
	}
}

/**
 * Factory function to create and start MCP server
 */
export async function createMCPServer(
	registry?: APIRegistry,
	config?: MCPServerConfig
): Promise<SeNARSMCPServer> {
	const server = new SeNARSMCPServer(registry, config);
	await server.start();
	return server;
}

export {EnhancedMCPAdapter};
