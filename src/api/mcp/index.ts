/**
 * MCP Module
 * Model Context Protocol integration for SeNARS using official SDK
 */

export {
  registerNARTools,
  registerNARTools as registerNARToolsAsMCP,
  registerAgentAPI,
} from '../mcp-tools.js';

export { registerMCPResources, getResourceContent } from '../mcp-resources.js';
export type { MCPResourceContext } from '../mcp-resources.js';

export { registerMCPPrompts } from '../mcp-prompts.js';

// Re-export SDK types for convenience
export type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
export type { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';