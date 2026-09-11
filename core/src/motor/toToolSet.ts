import {jsonSchema, tool, type ToolSet} from 'ai';
import type {ToolRegistry} from './ToolRegistry.js';

export function motorToToolSet(motor: Pick<ToolRegistry, 'list' | 'execute'>): ToolSet {
    const set: ToolSet = {};
    const specs = typeof motor.list === 'function' ? motor.list() : [];
    for (const spec of specs) {
        set[spec.name] = tool({
            description: spec.description,
            inputSchema: jsonSchema(spec.inputSchema as Record<string, unknown>),
            execute: async (args) => {
                const result = await motor.execute(
                    spec.name,
                    (args ?? {}) as Record<string, unknown>
                );
                return result.success ? result.content : {error: result.error};
            },
        });
    }
    return set;
}
