/**
 * MCP (Model Context Protocol) Adapter for Unified API Registry
 * Adapts registry handlers to MCP tools
 */

import {APIRegistry} from './registry.js';

export interface MCPTool {
    name: string;
    description: string;
    inputSchema: Record<string, any>;
}

export interface MCPToolResult {
    content: Array<{
        type: string;
        text: string;
    }>;
    isError?: boolean;
}

export interface MCPToolCall {
    name: string;
    arguments?: Record<string, any>;
}

export class MCPAdapter {
    private registry: APIRegistry;

    constructor(registry?: APIRegistry) {
        this.registry = registry || APIRegistry.getInstance();
    }

    /**
     * Get all registered handlers as MCP tool definitions
     */
    getTools(): MCPTool[] {
        const tools: MCPTool[] = [];
        for (const [name, meta] of this.registry.getHandlers()) {
            tools.push({
                name: meta.name,
                description: meta.description,
                inputSchema: this.zodToJSONSchema(meta.params),
            });
        }
        return tools;
    }

    /**
     * Get a single tool definition by name
     */
    getTool(name: string): MCPTool | undefined {
        const meta = this.registry.getHandler(name);
        if (!meta) return undefined;

        return {
            name: meta.name,
            description: meta.description,
            inputSchema: this.zodToJSONSchema(meta.params),
        };
    }

    /**
     * Execute a tool call
     */
    async executeTool(call: MCPToolCall): Promise<MCPToolResult> {
        try {
            const result = await this.registry.invoke(call.name, call.arguments || {});
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        } catch (error: any) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error: ${error.message}`,
                    },
                ],
                isError: true,
            };
        }
    }

    /**
     * Get MCP protocol version
     */
    getVersion(): string {
        return '1.0.0';
    }

    /**
     * Get server info for MCP handshake
     */
    getServerInfo(): Record<string, any> {
        return {
            name: 'senars-mcp',
            version: '1.0.0',
            protocolVersion: this.getVersion(),
            capabilities: {
                tools: true,
                resources: false,
                prompts: false,
            },
        };
    }

    /**
     * Convert Zod schema to JSON Schema for MCP
     */
    private zodToJSONSchema(schema: any): Record<string, any> {
        // Basic conversion - handles common Zod types
        if (!schema?._def) {
            return {type: 'object', properties: {}};
        }

        const def = schema._def;
        const result: Record<string, any> = {};

        // Type mapping
        const typeMap: Record<string, string> = {
            ZodString: 'string',
            ZodNumber: 'number',
            ZodBoolean: 'boolean',
            ZodArray: 'array',
            ZodObject: 'object',
            ZodOptional: 'object',
            ZodRecord: 'object',
        };

        const typeName = def.typeName;
        if (typeName in typeMap) {
            result.type = typeMap[typeName];
        }

        // Handle object properties
        if (typeName === 'ZodObject') {
            result.properties = {};
            const shape = def.shape();
            for (const [key, value] of Object.entries(shape)) {
                result.properties[key] = this.zodToJSONSchema(value as any);
            }
        }

        // Handle optional
        if (typeName === 'ZodOptional') {
            return this.zodToJSONSchema(def.innerType);
        }

        // Handle string constraints
        if (typeName === 'ZodString') {
            if (def.minLength) result.minLength = def.minLength;
            if (def.maxLength) result.maxLength = def.maxLength;
        }

        // Handle number constraints
        if (typeName === 'ZodNumber') {
            if (def.minimum !== undefined) result.minimum = def.minimum;
            if (def.maximum !== undefined) result.maximum = def.maximum;
        }

        return result;
    }
}
