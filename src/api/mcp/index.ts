/**
 * MCP Adapter Module
 * Model Context Protocol integration for SeNARS
 */

export type { MCPTool } from '../mcp-adapter.js';
// Base adapter
export { MCPAdapter } from '../mcp-adapter.js';
// Enhanced adapter with advanced features
export * from './enhanced-adapter.js';
export * from './prompt-manager.js';
// Resource and Prompt managers (they export their own ResourceContent)
export * from './resource-manager.js';
// Schema transformer
export * from './schema-transformer.js';
// Core types
export type {
  CapabilityDescriptor,
  EmbeddedResource,
  ExecutionContext,
  ExecutionResult,
  ImageContent,
  LogEntry,
  MCPContent,
  MCPMessage,
  MCPToolCall,
  MCPToolResult,
  ProgressUpdate,
  PromptArgument,
  PromptTemplate,
  ResourceDescriptor,
  TextContent,
  ValidationResult,
} from './types.js';
