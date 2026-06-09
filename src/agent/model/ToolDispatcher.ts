import type {NAR} from '../../nar/nar.js';

export interface ReasoningArtifact {
    type: 'derivation' | 'tool_result' | 'belief_added' | 'question_answered';
    content: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

export interface ToolCall {
    toolName: string;
    toolCallId: string;
    args: Record<string, unknown>;
}

export interface ToolError {
    toolCallId: string;
    toolName: string;
    message: string;
}

export interface ToolDispatchResult {
    artifacts: ReasoningArtifact[];
    errors: ToolError[];
}

export interface ToolDispatcherDeps {
    nar?: NAR;
    tools: Record<string, unknown>;
}

type ToolFn = (args: Record<string, unknown>) => Promise<unknown> | unknown;

interface ExecutableTool {
    execute?: ToolFn;
    description?: string;
}

/**
 * Execute a batch of tool calls and return the resulting artifacts + errors.
 * The dispatcher is pure with respect to the tools map (it does not mutate
 * it); side-effects happen inside the tool's own `execute`. Each
 * successful `nar_believe` produces a `belief_added` artifact; every
 * successful tool call (including `nar_query`) produces a `tool_result`
 * artifact. Errors are surfaced as `ToolError` so the LM can recover
 * without silently dropping the failure.
 */
export async function dispatchToolCalls(calls: ToolCall[], deps: ToolDispatcherDeps): Promise<ToolDispatchResult> {
    const artifacts: ReasoningArtifact[] = [];
    const errors: ToolError[] = [];

    for (const call of calls) {
        const tool = deps.tools[call.toolName] as ExecutableTool | undefined;
        if (!tool?.execute) {
            errors.push({toolCallId: call.toolCallId, toolName: call.toolName, message: `Tool ${call.toolName} not found or not executable`});
            continue;
        }
        let result: unknown;
        try {
            result = await tool.execute(call.args);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            const fields = Object.keys(call.args);
            const hint = fields.length
                ? ` (provided fields: ${fields.join(', ')})`
                : ' (no fields provided — likely missing required arguments)';
            errors.push({toolCallId: call.toolCallId, toolName: call.toolName, message: message + hint});
            continue;
        }

        artifacts.push({
            type: 'tool_result',
            content: `${call.toolName} -> ${summarize(result)}`,
            timestamp: Date.now(),
            metadata: {toolName: call.toolName, toolCallId: call.toolCallId, result},
        });

        if (call.toolName === 'nar_believe' && isBeliefSuccess(result)) {
            const r = result as {statement?: unknown};
            const statement = r.statement;
            const fallback = (call.args as {statement?: unknown}).statement;
            const content = typeof statement === 'string' ? statement : JSON.stringify(statement ?? fallback ?? '');
            artifacts.push({
                type: 'belief_added',
                content,
                timestamp: Date.now(),
                metadata: {toolName: call.toolName, toolCallId: call.toolCallId},
            });
        }
    }

    return {artifacts, errors};
}

function isBeliefSuccess(result: unknown): boolean {
    return typeof result === 'object' && result !== null && (result as {success?: unknown}).success === true;
}

function summarize(result: unknown): string {
    if (result == null) return 'null';
    if (typeof result === 'string') return result.length > 80 ? result.slice(0, 80) + '...' : result;
    try {
        const s = JSON.stringify(result);
        return s.length > 80 ? s.slice(0, 80) + '...' : s;
    } catch {
        return '[unserializable]';
    }
}
