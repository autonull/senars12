/**
 * MCP Adapter Types
 * Aligned with Model Context Protocol specification
 */

import {JSONSchema7} from 'json-schema';
import {z} from 'zod';

/**
 * Abstract capability descriptor (aligned with MCP tool schema)
 */
export interface CapabilityDescriptor {
	/** Unique identifier for agent discovery */
	name: string;
	/** Human-readable guidance */
	description?: string;
	/** JSON Schema Draft 7 compliant input schema */
	inputSchema: JSONSchema7;
	/** Optional: enables structured response parsing */
	outputSchema?: JSONSchema7;
	/** Non-protocol hints for UX/tooling */
	metadata?: {
		category?: string;
		longRunning?: boolean;
		requiresContext?: boolean;
	};
}

/**
 * Internal validation schema wrapper
 */
export interface InternalSchema {
	_def?: {
		typeName?: string;
		shape?: () => Record<string, unknown>;
		minLength?: number;
		maxLength?: number;
		minimum?: number;
		maximum?: number;
		innerType?: InternalSchema;
	};
}

/**
 * Schema transformation result
 */
export interface SchemaTransformationResult {
	jsonSchema: JSONSchema7;
	isValid: boolean;
	errors?: string[];
}

/**
 * Validation result from schema transformer
 */
export interface ValidationResult {
	isValid: boolean;
	errors: string[];
	data?: unknown;
}

/**
 * Abstract execution context (injected per request)
 */
export interface ExecutionContext {
	/** For cancellation propagation */
	signal?: AbortSignal;
	/** For long-running operations */
	reportProgress?: (p: ProgressUpdate) => void;
	/** For observability metadata */
	sendLog?: (entry: LogEntry) => void;
	/** Request-scoped context */
	metadata?: Record<string, unknown>;
}

/**
 * Progress update structure
 */
export interface ProgressUpdate {
	token: string | number;
	current: number;
	total?: number;
	message?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Log entry structure
 */
export interface LogEntry {
	level: 'debug' | 'info' | 'warn' | 'error';
	logger?: string;
	message: string;
	data?: Record<string, unknown>;
	timestamp?: number;
}

/**
 * Execution result wrapper
 */
export interface ExecutionResult {
	success: boolean;
	data?: unknown;
	error?: {
		code: string;
		message: string;
		details?: unknown;
	};
}

/**
 * Result formatter interface
 */
export interface ResultFormatter {
	/**
	 * Convert internal result → MCP content array (text/image/resource/etc.)
	 */
	format(result: unknown, descriptor: CapabilityDescriptor): MCPContent[];

	/**
	 * Optional: extract structured payload for machine consumption
	 */
	extractStructured(result: unknown, descriptor: CapabilityDescriptor): unknown;
}

/**
 * MCP content types (per spec)
 */
export type MCPContent =
	| TextContent
	| ImageContent
	| ResourceContent
	| EmbeddedResource;

export interface TextContent {
	type: 'text';
	text: string;
}

export interface ImageContent {
	type: 'image';
	data: string;
	mimeType: string;
}

export interface ResourceContent {
	type: 'resource';
	resource: {
		uri: string;
		mimeType?: string;
		text?: string;
		blob?: string;
	};
}

export interface EmbeddedResource {
	type: 'resource';
	resource: {
		uri: string;
		name: string;
		description?: string;
		mimeType?: string;
		text?: string;
		blob?: string;
	};
}

/**
 * Resource descriptor for MCP resource primitive
 */
export interface ResourceDescriptor {
	uriTemplate: string;
	name: string;
	description?: string;
	mimeType?: string;
	listable?: boolean;
}

/**
 * Prompt template for MCP prompt primitive
 */
export interface PromptTemplate {
	name: string;
	description?: string;
	arguments?: PromptArgument[];
}

/**
 * Prompt argument definition
 */
export interface PromptArgument {
	name: string;
	description?: string;
	required?: boolean;
	schema?: JSONSchema7;
}

/**
 * MCP message structure for prompts
 */
export interface MCPMessage {
	role: 'user' | 'assistant' | 'system';
	content: MCPContent[];
}

/**
 * Configuration for MCP adapter
 */
export interface MCPAdapterConfig {
	server: {
		name: string;
		version: string;
		protocolVersion?: string;
	};
	transports: {
		stdio?: {
			enabled: boolean;
		};
		sse?: {
			enabled: boolean;
			endpoint: string;
			port?: number;
		};
		streamableHttp?: {
			enabled: boolean;
			endpoint: string;
			port?: number;
			cors?: CORSConfig;
		};
	};
	capabilities: {
		tools?: {
			listChanged?: boolean;
		};
		resources?: {
			subscribe?: boolean;
			listChanged?: boolean;
		};
		prompts?: {
			listChanged?: boolean;
		};
		logging?: {
			level?: string;
		};
	};
	extensions?: Record<string, unknown>;
}

/**
 * CORS configuration for HTTP transports
 */
export interface CORSConfig {
	allowedOrigins: string[];
	allowedHeaders?: string[];
	allowedMethods?: string[];
}

/**
 * Default configuration factory
 */
export function createDefaultConfig(
	name: string = 'senars-mcp',
	version: string = '1.0.0'
): MCPAdapterConfig {
	return {
		server: {
			name,
			version,
			protocolVersion: '2024-11-05', // Latest MCP spec version
		},
		transports: {
			stdio: {
				enabled: true,
			},
			sse: {
				enabled: false,
				endpoint: '/mcp/sse',
				port: 8766,
			},
			streamableHttp: {
				enabled: false,
				endpoint: '/mcp',
				port: 8766,
			},
		},
		capabilities: {
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
			logging: {
				level: 'info',
			},
		},
	};
}
