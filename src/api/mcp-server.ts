/**
 * MCP Server Implementation
 * Full MCP protocol server using the unified API registry
 */

import {APIRegistry} from './registry.js';
import {MCPAdapter} from './mcp-adapter.js';

export interface MCPServerConfig {
    name?: string;
    version?: string;
    port?: number;
}

/**
 * MCP Server that exposes SeNARS API via Model Context Protocol
 */
export class MCPServer {
    private adapter: MCPAdapter;
    private config: Required<MCPServerConfig>;
    private port: number;

    constructor(registry?: APIRegistry, config: MCPServerConfig = {}) {
        this.adapter = new MCPAdapter(registry);
        this.config = {
            name: config.name ?? 'senars-mcp',
            version: config.version ?? '1.0.0',
            port: config.port ?? 8766,
        };
        this.port = this.config.port;
    }

    /**
     * Start the MCP server
     * For now, this is a placeholder - full MCP server would use stdio or SSE transport
     */
    async start(): Promise<void> {
        console.log(
            `MCP Server '${this.config.name}' v${this.config.version} ready`
        );
        console.log('Tools available:', this.adapter.getTools().map((t) => t.name).join(', '));
    }

    /**
     * Stop the MCP server
     */
    async stop(): Promise<void> {
        console.log('MCP Server stopped');
    }

    /**
     * Handle MCP tool call
     */
    async handleToolCall(name: string, args: Record<string, any>): Promise<any> {
        return this.adapter.executeTool({name, arguments: args});
    }

    /**
     * List available tools
     */
    listTools(): Array<{ name: string; description: string }> {
        return this.adapter.getTools().map((tool) => ({
            name: tool.name,
            description: tool.description,
        }));
    }

    /**
     * Get tool schema
     */
    getToolSchema(name: string): any {
        return this.adapter.getTool(name);
    }
}

export {MCPAdapter};
