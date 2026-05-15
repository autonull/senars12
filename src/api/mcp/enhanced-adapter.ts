/**
 * MCP Adapter Implementation
 * Adapts SeNARS API registry to Model Context Protocol
 */

import {MCPAdapter as BaseMCPAdapter} from '../mcp-adapter.js';
import {
	CapabilityDescriptor,
	ExecutionContext,
	ExecutionResult,
	ProgressUpdate,
	LogEntry,
} from './types.js';
import {SchemaTransformer, getSchemaTransformer} from './schema-transformer.js';
import {errMsg} from '../../nar/utils/helpers.js';
import {APIRegistry} from '../registry.js';

/**
 * Progress reporter callback type
 */
export type ProgressReporter = (update: ProgressUpdate) => void;

/**
 * Streaming handler for incremental results
 */
export interface StreamingHandler {
	/**
	 * Execute with streaming results
	 */
	executeStream(
		args: Record<string, unknown>,
		context: ExecutionContext & {
			yield: (chunk: unknown) => void;
		}
	): Promise<void>;
}

/**
 * Enhanced MCP Adapter with full protocol support
 * Implements capability registration, progress reporting, and dynamic discovery
 */
export class EnhancedMCPAdapter extends BaseMCPAdapter {
	protected capabilities: Map<string, CapabilityDescriptor> = new Map();
	protected progressTokens: Map<string | number, ProgressReporter> = new Map();
	protected activeProgressId: number = 0;

	constructor(registry?: APIRegistry) {
		super(registry);
		this.schemaTransformer = getSchemaTransformer();
	}

	/**
	 * Register a capability with full MCP metadata
	 */
	registerCapability(descriptor: CapabilityDescriptor): void {
		this.capabilities.set(descriptor.name, descriptor);
		this.logger.info(`Registered MCP capability: ${descriptor.name}`);
	}

	/**
	 * Unregister a capability
	 */
	unregisterCapability(name: string): void {
		this.capabilities.delete(name);
		this.logger.info(`Unregistered MCP capability: ${name}`);
	}

	/**
	 * List all registered capabilities
	 */
	listCapabilities(): CapabilityDescriptor[] {
		return Array.from(this.capabilities.values());
	}

	/**
	 * Get capability by name
	 */
	getCapability(name: string): CapabilityDescriptor | undefined {
		return this.capabilities.get(name);
	}

	/**
	 * Execute capability with context
	 */
	async executeWithProgress(
		name: string,
		args: Record<string, unknown>,
		token: string | number,
		reportProgress?: (update: ProgressUpdate) => void
	): Promise<ExecutionResult> {
		const capability = this.capabilities.get(name);

		if (!capability) {
			return {
				success: false,
				error: {
					code: 'CAPABILITY_NOT_FOUND',
					message: `Capability '${name}' not found`,
				},
			};
		}

		try {
			// Create execution context with progress reporting
			const context: ExecutionContext = {
				signal: new AbortController().signal,
				reportProgress: reportProgress,
				sendLog: (entry: LogEntry) => {
					this.logger.info(`[${entry.level}] ${entry.message}`, entry.data);
				},
			};

			// Execute with progress tracking
			const result = await this.executeCapability(name, args, context);

			return {
				success: true,
				data: result,
			};
		} catch (error) {
			return {
				success: false,
				error: {
					code: 'EXECUTION_ERROR',
					message: errMsg(error),
				},
			};
		}
	}

	/**
	 * Create a progress reporter with token
	 */
	createProgressReporter(token?: string | number): {
		reporter: ProgressReporter;
		token: string | number;
	} {
		const progressToken = token ?? this.activeProgressId++;

		const reporter: ProgressReporter = (update: ProgressUpdate) => {
			this.progressTokens.get(progressToken)?.(update);
		};

		return {reporter, token: progressToken};
	}

	/**
	 * Register progress handler for a token
	 */
	onProgress(token: string | number, handler: ProgressReporter): void {
		this.progressTokens.set(token, handler);
	}

	/**
	 * Remove progress handler
	 */
	removeProgressHandler(token: string | number): void {
		this.progressTokens.delete(token);
	}

	/**
	 * Execute capability with validated arguments
	 */
	protected async executeCapability(
		name: string,
		args: Record<string, unknown>,
		context: ExecutionContext
	): Promise<unknown> {
		const handler = this.registry.getHandler(name);

		if (!handler) {
			throw new Error(`Handler '${name}' not found`);
		}

		// Validate arguments
		const validation = this.schemaTransformer.validateArgs(
			args,
			handler.params
		);

		if (!validation.isValid) {
			throw new Error(
				`Invalid arguments: ${validation.errors.join(', ')}`
			);
		}

		// Execute handler
		return handler.handler(validation.data || args);
	}

	/**
	 * Get all capabilities as MCP tool definitions
	 */
	override getTools(): Array<{
		name: string;
		description: string;
		inputSchema: Record<string, unknown>;
	}> {
		const tools: Array<{
			name: string;
			description: string;
			inputSchema: Record<string, unknown>;
		}> = [];

		for (const [_name, meta] of this.registry.getHandlers()) {
			const descriptor = this.capabilities.get(meta.name);
			tools.push({
				name: meta.name,
				description: meta.description,
				inputSchema: (descriptor?.inputSchema as Record<string, unknown>) || this.zodToJSONSchema(meta.params),
			});
		}

		return tools;
	}

	/**
	 * Get server capabilities for MCP handshake
	 */
	getServerCapabilities(): Record<string, unknown> {
		return {
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
	}

	/**
	 * Get server info for MCP handshake
	 */
	override getServerInfo(): Record<string, unknown> {
		return {
			name: 'senars-mcp',
			version: '1.0.0',
			protocolVersion: '2024-11-05',
			capabilities: this.getServerCapabilities(),
		};
	}

	/**
	 * Convert Zod schema to JSON Schema using the transformer
	 */
	protected override zodToJSONSchema(schema: unknown): Record<string, unknown> {
		return this.schemaTransformer.toJSONSchema(schema as any) as Record<
			string,
			unknown
		>;
	}
}

/**
 * Factory function to create and initialize enhanced adapter
 */
export function createEnhancedMCPAdapter(
	registry?: APIRegistry
): EnhancedMCPAdapter {
	return new EnhancedMCPAdapter(registry);
}
