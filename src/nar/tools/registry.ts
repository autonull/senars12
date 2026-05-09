import type {
    Schema,
    Tool,
    ToolCapabilities,
    ToolChainResult,
    ToolChainStep,
    ToolContext,
    ToolFilter,
    ToolRegistry,
    ToolResult
} from './types';
import {ToolError} from '../types';

export class Registry implements ToolRegistry {
    private tools: Map<string, Tool> = new Map();

    register(tool: Tool): void {
        if (this.tools.has(tool.name)) {
            throw new ToolError(`Tool '${tool.name}' is already registered`, {tool: tool.name});
        }
        this.tools.set(tool.name, tool);
    }

    unregister(name: string): void {
        this.tools.delete(name);
    }

    get(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    list(_filter?: ToolFilter): Tool[] {
        return Array.from(this.tools.values());
    }

    async execute(name: string, args: Record<string, unknown>, context?: ToolContext): Promise<ToolResult> {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new ToolError(`Tool '${name}' not found`, {tool: name});
        }

        try {
            this.validateArgs(tool.parameters, args);
            const result = await tool.execute(args, context);
            return this.validateResult(result, tool);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                content: null,
                error: message
            };
        }
    }

    async executeChain(chain: ToolChainStep[]): Promise<ToolChainResult> {
        const results: ToolResult[] = [];
        const outputVars: Record<string, unknown> = {};

        for (const step of chain) {
            const args = {...step.args};

            for (const [key, value] of Object.entries(args)) {
                if (typeof value === 'string' && value.startsWith('$')) {
                    const varName = value.slice(1);
                    if (outputVars[varName]) {
                        args[key] = outputVars[varName];
                    }
                }
            }

            const result = await this.execute(step.tool, args);
            results.push(result);

            if (!result.success) {
                return {
                    success: false,
                    results,
                    error: result.error
                };
            }

            if (step.outputAs) {
                outputVars[step.outputAs] = result.content;
            }
        }

        return {
            success: true,
            results,
            finalContent: results[results.length - 1]?.content
        };
    }

    getCapabilities(name: string): ToolCapabilities | undefined {
        const tool = this.tools.get(name);
        return tool?.capabilities;
    }

    private validateResult(result: ToolResult, _tool: Tool): ToolResult {
        if (result.partial && result.success) {
            if (!result.metadata?.hasMore) {
                result.partial = false;
            }
        }

        return result;
    }

    private validateArgs(schema: Schema, args: Record<string, unknown>): void {
        if (!schema) return;

        if (schema.required) {
            for (const required of schema.required) {
                if (!(required in args)) {
                    throw new ToolError(`Missing required parameter: ${required}`, {
                        tool: schema.type,
                        parameter: required
                    });
                }
            }
        }

        for (const [key, value] of Object.entries(args)) {
            const prop = schema.properties?.[key];
            if (prop) {
                this.validateType(key, value, prop);
            }
        }
    }

    private validateType(key: string, value: unknown, prop: Schema['properties'][string]): void {
        const typeChecks: Record<string, () => boolean> = {
            string: () => typeof value === 'string',
            number: () => typeof value === 'number',
            boolean: () => typeof value === 'boolean',
            array: () => Array.isArray(value),
            object: () => typeof value === 'object' && value !== null && !Array.isArray(value)
        };

        const check = typeChecks[prop.type];
        if (check && !check()) {
            throw new ToolError(`Invalid type for ${key}: expected ${prop.type}`, {
                parameter: key,
                expected: prop.type,
                actual: typeof value
            });
        }

        if (prop.type === 'number') {
            if (prop.minimum !== undefined && (value as number) < prop.minimum) {
                throw new ToolError(`Value for ${key} is below minimum: ${prop.minimum}`, {
                    parameter: key,
                    minimum: prop.minimum
                });
            }
            if (prop.maximum !== undefined && (value as number) > prop.maximum) {
                throw new ToolError(`Value for ${key} exceeds maximum: ${prop.maximum}`, {
                    parameter: key,
                    maximum: prop.maximum
                });
            }
        }

        if (prop.type === 'string' && typeof value === 'string') {
            if (prop.minLength !== undefined && value.length < prop.minLength) {
                throw new ToolError(`String ${key} is too short`, {parameter: key, minLength: prop.minLength});
            }
            if (prop.maxLength !== undefined && value.length > prop.maxLength) {
                throw new ToolError(`String ${key} is too long`, {parameter: key, maxLength: prop.maxLength});
            }
            if (prop.pattern) {
                const regex = new RegExp(prop.pattern);
                if (!regex.test(value)) {
                    throw new ToolError(`String ${key} does not match pattern: ${prop.pattern}`, {
                        parameter: key,
                        pattern: prop.pattern
                    });
                }
            }
            if (prop.enum && !prop.enum.includes(value)) {
                throw new ToolError(`String ${key} is not in allowed values`, {parameter: key, allowed: prop.enum});
            }
        }
    }
}
