/**
 * MCP Adapter Module
 * Model Context Protocol integration for SeNARS
 */

// Core types (exclude ResourceContent which is re-exported from resource-manager)
export type {
	CapabilityDescriptor,
	InternalSchema,
	SchemaTransformationResult,
	ValidationResult,
	ExecutionContext,
	ProgressUpdate,
	LogEntry,
	ExecutionResult,
	ResultFormatter,
	MCPContent,
	TextContent,
	ImageContent,
	EmbeddedResource,
	ResourceDescriptor,
	PromptTemplate,
	PromptArgument,
	MCPMessage,
	MCPAdapterConfig,
	CORSConfig,
} from './types.js';

// Schema transformer
export * from './schema-transformer.js';

// Base adapter
export {MCPAdapter} from '../mcp-adapter.js';
export type {MCPTool, MCPToolResult, MCPToolCall} from '../mcp-adapter.js';

// Enhanced adapter with advanced features
export * from './enhanced-adapter.js';

// Resource and Prompt managers (they export their own ResourceContent)
export * from './resource-manager.js';
export * from './prompt-manager.js';
