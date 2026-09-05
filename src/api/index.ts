/**
 * Unified API Layer
 * Export all API components
 */

export { HTTPAdapter } from './http-adapter.js';
// MCP exports (using official SDK)
export {
  registerNARTools,
  registerMCPResources,
  registerMCPPrompts,
} from './mcp-tools.js';
export { registerNARTools as registerNARToolsAsMCP } from './mcp-tools.js';
export { registerAgentAPI } from './mcp-tools.js';
export { APIRegistry } from './registry.js';
export { WebSocketAdapter } from './websocket-adapter.js';
