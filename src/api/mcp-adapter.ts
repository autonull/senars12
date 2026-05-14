/**
 * MCP (Model Context Protocol) Adapter for Unified API Registry
 * Adapts registry handlers to MCP tools
 */

import {APIRegistry} from './registry.js';

export interface MCPTool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
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
    arguments?: Record<string, unknown>;
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
        for (const [_name, meta] of this.registry.getHandlers()) {
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
        } catch (error: unknown) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
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
    getServerInfo(): Record<string, unknown> {
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
    private zodToJSONSchema(schema: unknown): Record<string, unknown> {
        const def = (schema as { _def?: Record<string, unknown> })?._def;
        if (!def) {
            return {type: 'object', properties: {}};
        }

        const result: Record<string, unknown> = {};

        const typeMap: Record<string, string> = {
            ZodString: 'string',
            ZodNumber: 'number',
            ZodBoolean: 'boolean',
            ZodArray: 'array',
            ZodObject: 'object',
            ZodOptional: 'object',
            ZodRecord: 'object',
        };

        const typeName = def.typeName as string | undefined;
        if (typeName && typeName in typeMap) {
            result.type = typeMap[typeName];
        }

        if (typeName === 'ZodObject' && typeof def.shape === 'function') {
            const properties: Record<string, unknown> = {};
            const shape = def.shape() as Record<string, unknown>;
            for (const [key, value] of Object.entries(shape)) {
                properties[key] = this.zodToJSONSchema(value);
            }
            result.properties = properties;
        }

        if (typeName === 'ZodOptional' && def.innerType) {
            return this.zodToJSONSchema(def.innerType);
        }

        if (typeName === 'ZodString') {
            if (def.minLength) result.minLength = def.minLength;
            if (def.maxLength) result.maxLength = def.maxLength;
        }

        if (typeName === 'ZodNumber') {
            if (def.minimum !== undefined) result.minimum = def.minimum;
            if (def.maximum !== undefined) result.maximum = def.maximum;
        }

        return result;
    }
}
