/**
 * Unified API Layer
 * Export all API components
 */

export { HTTPAdapter } from './http-adapter.js';
// MCP exports (enhanced)
export * from './mcp/index.js';
export type { MCPToolCall, MCPToolResult } from './mcp/types.js';
export type { MCPTool } from './mcp-adapter.js';
// MCP exports (legacy compatibility)
export { MCPAdapter } from './mcp-adapter.js';
export { SeNARSMCPServer as MCPServer } from './mcp-server.js';
export { APIRegistry } from './registry.js';
export { WebSocketAdapter } from './websocket-adapter.js';
