/**
 * MCP Adapter Module
 * Model Context Protocol integration for SeNARS
 */

// Core types
export type {
	CapabilityDescriptor,
	ValidationResult,
	ExecutionContext,
	ProgressUpdate,
	LogEntry,
	ExecutionResult,
	MCPContent,
	TextContent,
	ImageContent,
	EmbeddedResource,
	ResourceDescriptor,
	PromptTemplate,
	PromptArgument,
	MCPMessage,
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
