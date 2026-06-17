/**
 * Unified API Layer
 * Export all API components
 */

export {APIRegistry} from './registry.js';
export {HTTPAdapter} from './http-adapter.js';
export {WebSocketAdapter} from './websocket-adapter.js';

// MCP exports (legacy compatibility)
export {MCPAdapter} from './mcp-adapter.js';
export {SeNARSMCPServer as MCPServer} from './mcp-server.js';
export type {MCPTool, MCPToolResult, MCPToolCall} from './mcp-adapter.js';

// MCP exports (enhanced)
export * from './mcp/index.js';
