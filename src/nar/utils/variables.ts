export const isVariableReference = (value: unknown): value is string =>
    typeof value === 'string' && value.startsWith('$');

export const extractVarName = (value: string): string => value.slice(1);

export const resolveVariables = (
    args: Record<string, unknown>,
    vars: Record<string, unknown>
): Record<string, unknown> => {
    const resolved = {...args};
    for (const [key, value] of Object.entries(args)) {
        if (isVariableReference(value)) {
            const varName = extractVarName(value);
            if (vars[varName]) resolved[key] = vars[varName];
        }
    }
    return resolved;
};