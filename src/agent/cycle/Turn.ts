export type Turn =
    | { kind: 'response'; text: string; confidence: number }
    | { kind: 'tool_calls'; calls: ReadonlyArray<{ name: string; args: Record<string, unknown> }> }
    | { kind: 'internal'; note: string };

export interface ToolCall {
    readonly name: string;
    readonly args: Record<string, unknown>;
}

export const isResponse = (t: Turn): t is Extract<Turn, { kind: 'response' }> => t.kind === 'response';
export const isToolCalls = (t: Turn): t is Extract<Turn, { kind: 'tool_calls' }> => t.kind === 'tool_calls';
export const isInternal = (t: Turn): t is Extract<Turn, { kind: 'internal' }> => t.kind === 'internal';
