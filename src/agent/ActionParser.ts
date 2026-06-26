import {z} from 'zod';
import {makeId} from '../nar/utils/index.js';

export interface ToolCall {
    tool: string;
    parameters: Record<string, unknown>;
    id: string;
}

export interface ToolSchema {
    name: string;
    description: string;
    parameters: z.ZodSchema;
}

export class ActionParser {
    private readonly toolSchemas: Map<string, ToolSchema> = new Map();
    private readonly toolPatterns: ToolPattern[] = [];

    registerTool(schema: ToolSchema): void {
        this.toolSchemas.set(schema.name, schema);
    }

    registerTools(schemas: ToolSchema[]): void {
        for (const schema of schemas) {
            this.registerTool(schema);
        }
    }

    parse(output: string): ToolCall[] {
        const jsonMatch = output.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            try {
                const calls = JSON.parse(jsonMatch[0]);
                if (Array.isArray(calls)) {
                    return calls.map((c: any) => ({
                        tool: c.tool || c.name,
                        parameters: c.parameters || c.args || {},
                        id: c.id || makeId(),
                    })).filter(c => c.tool);
                }
            } catch {
            }
        }

        return this.parseNaturalLanguage(output);
    }

    private parseNaturalLanguage(output: string): ToolCall[] {
        const calls: ToolCall[] = [];

        for (const pattern of this.toolPatterns) {
            const matches = output.matchAll(pattern.regex);
            for (const match of matches) {
                calls.push({
                    tool: pattern.tool,
                    parameters: pattern.extractParams(match),
                    id: makeId(),
                });
            }
        }

        return calls;
    }

    addToolPattern(pattern: ToolPattern): void {
        this.toolPatterns.push(pattern);
    }

    validateToolCall(call: ToolCall): {valid: boolean; errors: string[]} {
        const schema = this.toolSchemas.get(call.tool);
        if (!schema) {
            return {valid: false, errors: [`Unknown tool: ${call.tool}`]};
        }

        const result = schema.parameters.safeParse(call.parameters);
        if (!result.success) {
            return {valid: false, errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)};
        }

        return {valid: true, errors: []};
    }

    getRegisteredTools(): string[] {
        return Array.from(this.toolSchemas.keys());
    }
}

export interface ToolPattern {
    tool: string;
    regex: RegExp;
    extractParams: (match: RegExpMatchArray) => Record<string, unknown>;
}

export function createActionParser(): ActionParser {
    return new ActionParser();
}