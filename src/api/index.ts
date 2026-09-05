/**
 * Unified API Layer
 * Export all API components
 */

export { HTTPAdapter } from './http-adapter.js';
export { registerMCPPrompts } from './mcp-prompts.js';
export type { MCPResourceContext } from './mcp-resources.js';
export { getResourceContent, registerMCPResources } from './mcp-resources.js';
// MCP exports (using official SDK)
export {
  registerAgentAPI,
  registerNARTools,
  registerNARTools as registerNARToolsAsMCP,
} from './mcp-tools.js';
export { APIRegistry } from './registry.js';
export { WebSocketAdapter } from './websocket-adapter.js';
