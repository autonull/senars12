/**
 * Unified API Layer
 * Export all API components
 */

export { HTTPAdapter } from './http-adapter.js';
// MCP exports (using official SDK)
export {
  registerNARTools,
  registerNARTools as registerNARToolsAsMCP,
  registerAgentAPI,
} from './mcp-tools.js';
export { registerMCPResources, getResourceContent } from './mcp-resources.js';
export type { MCPResourceContext } from './mcp-resources.js';
export { registerMCPPrompts } from './mcp-prompts.js';
export { APIRegistry } from './registry.js';
export { WebSocketAdapter } from './websocket-adapter.js';