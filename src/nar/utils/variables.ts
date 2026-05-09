export const resolveVariables = (
    args: Record<string, unknown>,
    vars: Record<string, unknown>
): Record<string, unknown> => {
    const resolved = {...args};
    for (const [key, value] of Object.entries(args)) {
        if (typeof value === 'string' && value.startsWith('$')) {
            const varName = value.slice(1);
            if (vars[varName]) resolved[key] = vars[varName];
        }
    }
    return resolved;
};