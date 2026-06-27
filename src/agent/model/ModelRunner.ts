import {generateText} from 'ai';

import type {LMService} from '../../nar/lm';
import type {ReasoningArtifact, ToolCall, ToolError} from './ToolDispatcher.js';
import {errMsg} from '../../nar/utils';

export interface ComposedRequest {
    system: string;
    messages: Array<{
        role: 'user' | 'assistant' | 'system' | 'tool';
        content: string | unknown[];
        timestamp?: number
    }>;
    tools: Record<string, unknown>;
    ctxHash: string;
    snapshot: unknown;
    budget: { systemTokens: number; historyTokens: number; snapshotTokens: number; total: number; maxTokens: number };
}

export type ModelEvent =
    | { kind: 'text-delta'; text: string }
    | { kind: 'tool-call'; call: ToolCall }
    | { kind: 'tool-result'; call: ToolCall; result: unknown }
    | { kind: 'tool-error'; call: ToolCall; error: string }
    | { kind: 'finish'; text: string; toolCalls: ToolCall[] };

export interface ModelRunResult {
    text: string;
    toolCalls: ToolCall[];
    artifacts: ReasoningArtifact[];
    errors: ToolError[];
    messages: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string | unknown[] }>;
    usage: { inputTokens: number; outputTokens: number; totalTokens: number };
}

export interface ModelRunnerDeps {
    lmService?: LMService;
    maxLoops?: number;
    maxOutputTokens?: number;
    maxToolResultEntries?: number;
    maxToolResultChars?: number;
}

const DEFAULT_MAX_TOOL_RESULT_ENTRIES = 20;
const DEFAULT_MAX_TOOL_RESULT_CHARS = 8_000;

export class ModelRunner {
    private readonly lmService?: LMService;
    private readonly maxLoops: number;
    private readonly maxOutputTokens: number;
    private readonly maxToolResultEntries: number;
    private readonly maxToolResultChars: number;

    constructor(deps: ModelRunnerDeps) {
        this.lmService = deps.lmService;
        this.maxLoops = deps.maxLoops ?? 5;
        this.maxOutputTokens = deps.maxOutputTokens ?? 2048;
        this.maxToolResultEntries = deps.maxToolResultEntries ?? DEFAULT_MAX_TOOL_RESULT_ENTRIES;
        this.maxToolResultChars = deps.maxToolResultChars ?? DEFAULT_MAX_TOOL_RESULT_CHARS;
    }

    hasModel(): boolean {
        return !!this.lmService?.available;
    }

    private toMessages(composed: ComposedRequest): any[] {
        return composed.messages.map(m => ({role: m.role, content: m.content}));
    }

    async* run(composed: ComposedRequest, signal?: AbortSignal): AsyncGenerator<ModelEvent, ModelRunResult> {
        if (!this.lmService || !this.lmService.available) {
            return {
                text: '',
                toolCalls: [],
                artifacts: [],
                errors: [],
                messages: composed.messages,
                usage: {inputTokens: 0, outputTokens: 0, totalTokens: 0}
            };
        }

        const model = this.lmService.getModel('fast');
        if (!model) {
            return {
                text: 'No model available',
                toolCalls: [],
                artifacts: [],
                errors: [],
                messages: composed.messages,
                usage: {inputTokens: 0, outputTokens: 0, totalTokens: 0}
            };
        }

        const allCalls: ToolCall[] = [];
        const allArtifacts: ReasoningArtifact[] = [];
        const allErrors: ToolError[] = [];
        let text = '';
        let totalInput = 0;
        let totalOutput = 0;

        const toolsArray = toToolArray(composed.tools);
        const messages = this.toMessages(composed);

        for (let loop = 0; loop < this.maxLoops; loop++) {
            if (signal?.aborted) break;

            try {
                const result = await generateText({
                    model,
                    messages,
                    system: composed.system || undefined,
                    allowSystemInMessages: true,
                    tools: toolsArray.length > 0 ? toolsToToolSet(toolsArray) : undefined,
                    maxOutputTokens: this.maxOutputTokens,
                    abortSignal: signal,
                } as any);

                text = result.text;
                if (result.usage) {
                    totalInput += result.usage.inputTokens ?? 0;
                    totalOutput += result.usage.outputTokens ?? 0;
                }

                if (text) yield {kind: 'text-delta', text};
                break;
            } catch (e) {
                if (loop === this.maxLoops - 1) {
                    return {
                        text: errMsg(e),
                        toolCalls: allCalls,
                        artifacts: allArtifacts,
                        errors: allErrors,
                        messages,
                        usage: {inputTokens: totalInput, outputTokens: totalOutput, totalTokens: totalInput + totalOutput}
                    };
                }
            }
        }

        yield {kind: 'finish', text, toolCalls: allCalls};
        return {
            text,
            toolCalls: allCalls,
            artifacts: allArtifacts,
            errors: allErrors,
            messages,
            usage: {inputTokens: totalInput, outputTokens: totalOutput, totalTokens: totalInput + totalOutput}
        };
    }
}

function toToolArray(tools: Record<string, unknown>): Array<{ type: string; name: string; description?: string; inputSchema?: unknown }> {
    return Object.entries(tools).map(([name, def]) => {
        const d = def as { description?: string; inputSchema?: unknown } | undefined;
        return {
            type: 'function',
            name, ...(d?.description ? {description: d.description} : {}), ...(d?.inputSchema ? {inputSchema: d.inputSchema} : {})
        };
    });
}

function toolsToToolSet(tools: Array<{ type: string; name: string; description?: string; inputSchema?: unknown }>) {
    const toolSet: Record<string, any> = {};
    for (const t of tools) {
        toolSet[t.name] = {
            description: t.description,
            inputSchema: t.inputSchema,
            execute: async () => ({}),
        };
    }
    return toolSet;
}