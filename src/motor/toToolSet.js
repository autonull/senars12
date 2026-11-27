import { jsonSchema, tool } from 'ai';
export function motorToToolSet(motor) {
    const set = {};
    const specs = typeof motor.list === 'function' ? motor.list() : [];
    for (const spec of specs) {
        set[spec.name] = tool({
            description: spec.description,
            inputSchema: jsonSchema(spec.parameters),
            execute: async (args) => {
                const result = await motor.execute(spec.name, (args ?? {}));
                return result.success ? result.content : { error: result.error };
            },
        });
    }
    return set;
}
