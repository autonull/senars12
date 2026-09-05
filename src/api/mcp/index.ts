/**
 * MCP Module
 * Model Context Protocol integration for SeNARS using official SDK
 */

// Re-export SDK types for convenience
export type { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
export { registerMCPPrompts } from '../mcp-prompts.js';
export type { MCPResourceContext } from '../mcp-resources.js';
export { getResourceContent, registerMCPResources } from '../mcp-resources.js';
export {
  registerAgentAPI,
  registerNARTools,
  registerNARTools as registerNARToolsAsMCP,
} from '../mcp-tools.js';
