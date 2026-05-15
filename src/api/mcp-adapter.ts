/**
 * MCP (Model Context Protocol) Adapter for Unified API Registry
 * Adapts registry handlers to MCP tools
 */

import {BaseAdapter} from './base-adapter.js';
import {z} from 'zod';
import {SchemaTransformer} from './mcp/schema-transformer.js';
import {errMsg} from '../nar/utils/helpers.js';

export interface MCPTool {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
}

export interface MCPToolResult {
	content: Array<{
		type: string;
		text: string;
	}>;
	isError?: boolean;
}

export interface MCPToolCall {
	name: string;
	arguments?: Record<string, unknown>;
}

export class MCPAdapter extends BaseAdapter {
	protected schemaTransformer: SchemaTransformer;

	constructor() {
		super('api:mcp');
		this.schemaTransformer = new SchemaTransformer();
	}

	/**
	 * Get all registered handlers as MCP tool definitions
	 */
	getTools(): MCPTool[] {
		const tools: MCPTool[] = [];
		for (const [_name, meta] of this.registry.getHandlers()) {
			tools.push({
				name: meta.name,
				description: meta.description,
				inputSchema: this.zodToJSONSchema(meta.params),
			});
		}
		return tools;
	}

	/**
	 * Execute a tool call
	 */
	async executeTool(call: MCPToolCall): Promise<MCPToolResult> {
		try {
			const result = await this.registry.invoke(
				call.name,
				call.arguments || {}
			);
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		} catch (error: unknown) {
			return {
				content: [{type: 'text', text: JSON.stringify({type: 'error', error: {code: 'HANDLER_ERROR', message: errMsg(error)}, timestamp: Date.now()}, null, 2)}],
				isError: true,
			};
		}
	}

	/**
	 * Get MCP protocol version
	 */
	getVersion(): string {
		return '2024-11-05'; // Latest MCP spec version
	}

	/**
	 * Get server info for MCP handshake
	 */
	getServerInfo(): Record<string, unknown> {
		return {
			name: 'senars-mcp',
			version: '1.0.0',
			protocolVersion: this.getVersion(),
			capabilities: {
				tools: true,
				resources: false,
				prompts: false,
			},
		};
	}

	/**
	 * Convert Zod schema to JSON Schema using transformer
	 */
	protected zodToJSONSchema(schema: z.ZodSchema | unknown): Record<string, unknown> {
		return this.schemaTransformer.toJSONSchema(schema) as Record<
			string,
			unknown
		>;
	}
}
