import type {LMClient} from '../../nar/lm';
import {adapt, type AISDKLanguageModel} from '../../nar/lm/adapters';
import {dispatchToolCalls, type ReasoningArtifact, type ToolCall, type ToolError} from './ToolDispatcher.js';
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
    lmClient?: LMClient;
    maxLoops?: number;
    maxOutputTokens?: number;
    maxToolResultEntries?: number;
    maxToolResultChars?: number;
}

const DEFAULT_MAX_TOOL_RESULT_ENTRIES = 20;
const DEFAULT_MAX_TOOL_RESULT_CHARS = 8_000;

/**
 * Wraps the AI SDK adapter and runs the tool-call loop.
 *
 * The adapter (`AISDKAdapter`) turns a flat-prompt `LMClient` into a V2
 * `LanguageModelV2` whose `doGenerate` already returns a structured
 * `content` array containing `text` and `tool-call` parts (parsed from
 * the LM's natural-language response). `ModelRunner` consumes that
 * structure and drives the multi-step conversation explicitly so the
 * rest of the agent can observe every event:
 *
 *   1. call `doGenerate`
 *   2. yield any new text deltas
 *   3. for each tool-call part, dispatch through `ToolDispatcher`,
 *      collect artifacts + errors, yield the result/error
 *   4. append the assistant `tool-call` and `tool-result` parts to the
 *      message history so the LM sees its own actions
 *   5. loop until no tool calls, or `maxLoops` reached
 *
 * `maxLoops` is supplied by `createAgent` (or the host) from
 * `botConfig.reasoning.maxStepsPerTrigger`; we don't reach for the AI
 * SDK's `generateText` / `streamText` because we want full control over
 * the event surface (the SDK's internal multi-step loop is opaque).
 */
export class ModelRunner {
    private readonly model?: AISDKLanguageModel;
    private readonly maxLoops: number;
    private readonly maxOutputTokens: number;
    private readonly maxToolResultEntries: number;
    private readonly maxToolResultChars: number;

    constructor(deps: ModelRunnerDeps) {
        this.model = deps.lmClient ? adapt(deps.lmClient) : undefined;
        this.maxLoops = deps.maxLoops ?? 5;
        this.maxOutputTokens = deps.maxOutputTokens ?? 2048;
        this.maxToolResultEntries = deps.maxToolResultEntries ?? DEFAULT_MAX_TOOL_RESULT_ENTRIES;
        this.maxToolResultChars = deps.maxToolResultChars ?? DEFAULT_MAX_TOOL_RESULT_CHARS;
    }

    hasModel(): boolean {
        return this.model !== undefined;
    }

    async* run(composed: ComposedRequest, signal?: AbortSignal): AsyncGenerator<ModelEvent, ModelRunResult> {
        if (!this.model) {
            return {
                text: '',
                toolCalls: [],
                artifacts: [],
                errors: [],
                messages: composed.messages,
                usage: {inputTokens: 0, outputTokens: 0, totalTokens: 0}
            };
        }

        const messages: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string | unknown[] }> =
            composed.messages.map(m => ({role: m.role, content: m.content as string | unknown[]}));

        const allCalls: ToolCall[] = [];
        const allArtifacts: ReasoningArtifact[] = [];
        const allErrors: ToolError[] = [];
        const toolsArray = toToolArray(composed.tools);
        let text = '';
        let totalInput = 0;
        let totalOutput = 0;

        for (let loop = 0; loop < this.maxLoops; loop++) {
            if (signal?.aborted) break;

            let result;
            try {
                const messagesWithSystem = composed.system
                    ? [{role: 'system' as const, content: composed.system}, ...messages]
                    : messages;
                result = await this.model.doGenerate({
                    prompt: messagesWithSystem as never,
                    tools: toolsArray,
                    maxOutputTokens: this.maxOutputTokens,
                    ...(signal ? {abortSignal: signal} : {}),
                });
            } catch (e) {
                const message = errMsg(e);
                return {
                    text: message,
                    toolCalls: allCalls,
                    artifacts: allArtifacts,
                    errors: allErrors,
                    messages,
                    usage: {inputTokens: totalInput, outputTokens: totalOutput, totalTokens: totalInput + totalOutput}
                };
            }

            if (result.usage) {
                totalInput += result.usage.inputTokens;
                totalOutput += result.usage.outputTokens;
            }

            let stepText = '';
            const stepToolCalls: Array<{ toolCallId: string; toolName: string; input: unknown }> = [];
            for (const part of result.content) {
                if (part.type === 'text') {
                    stepText += part.text;
                } else {
                    stepToolCalls.push({toolCallId: part.toolCallId, toolName: part.toolName, input: part.input});
                }
            }
            if (stepText && stepText !== text) {
                const delta = stepText.slice(text.length);
                text = stepText;
                if (delta) yield {kind: 'text-delta', text: delta};
            } else {
                text = stepText || text;
            }

            if (stepToolCalls.length === 0) {
                if (stepText) {
                    messages.push({role: 'assistant', content: [{type: 'text', text: stepText}] as unknown[]});
                }
                break;
            }

            const mapped: ToolCall[] = stepToolCalls.map((tc, idx) => ({
                toolName: tc.toolName,
                toolCallId: tc.toolCallId || `tc_${loop}_${idx}`,
                args: ((tc.input ?? {}) as Record<string, unknown>),
            }));
            allCalls.push(...mapped);

            messages.push({
                role: 'assistant',
                content: [
                    ...(stepText ? [{type: 'text', text: stepText}] : []),
                    ...mapped.map(c => ({
                        type: 'tool-call',
                        toolCallId: c.toolCallId,
                        toolName: c.toolName,
                        input: c.args
                    })),
                ] as unknown[],
            });

            for (const c of mapped) yield {kind: 'tool-call', call: c};

            const dispatch = await dispatchToolCalls(mapped, {tools: composed.tools});
            const truncatedArtifacts = dispatch.artifacts.map(a => truncateArtifact(a, this.maxToolResultEntries, this.maxToolResultChars));
            const truncatedResults = new Map<string, unknown>();
            for (const a of truncatedArtifacts) {
                if (a.type !== 'tool_result') continue;
                const id = String(a.metadata?.toolCallId ?? '');
                if (!truncatedResults.has(id)) {
                    truncatedResults.set(id, a.metadata?.result);
                }
            }
            allArtifacts.push(...truncatedArtifacts);
            allErrors.push(...dispatch.errors);

            for (const c of mapped) {
                const result = truncatedResults.get(c.toolCallId);
                if (result !== undefined) yield {kind: 'tool-result', call: c, result};
            }
            for (const e of dispatch.errors) {
                const c = mapped.find(x => x.toolCallId === e.toolCallId);
                if (c) yield {kind: 'tool-error', call: c, error: e.message};
            }

            const toolResultContent: unknown[] = [];
            for (const c of mapped) {
                if (truncatedResults.has(c.toolCallId)) {
                    toolResultContent.push({
                        type: 'tool-result',
                        toolCallId: c.toolCallId,
                        toolName: c.toolName,
                        result: truncatedResults.get(c.toolCallId),
                    });
                } else {
                    const err = dispatch.errors.find(x => x.toolCallId === c.toolCallId);
                    if (err) {
                        toolResultContent.push({
                            type: 'tool-result',
                            toolCallId: c.toolCallId,
                            toolName: c.toolName,
                            result: {error: err.message},
                        });
                    }
                }
            }
            messages.push({role: 'tool', content: toolResultContent});
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

function toToolArray(tools: Record<string, unknown>): Array<{
    type: string;
    name: string;
    description?: string;
    inputSchema?: unknown
}> {
    return Object.entries(tools).map(([name, def]) => {
        const d = def as { description?: string; inputSchema?: unknown } | undefined;
        return {
            type: 'function',
            name, ...(d?.description ? {description: d.description} : {}), ...(d?.inputSchema ? {inputSchema: d.inputSchema} : {})
        };
    });
}

export function truncateArtifact(
    artifact: ReasoningArtifact,
    maxEntries: number,
    maxChars: number,
): ReasoningArtifact {
    if (artifact.metadata?.result === undefined) return artifact;
    const truncated = truncateResult(artifact.metadata.result, maxEntries, maxChars);
    if (truncated === artifact.metadata.result) return artifact;
    return {
        ...artifact,
        metadata: {
            ...(artifact.metadata ?? {}),
            result: truncated,
            truncated: true,
            originalSize: estimateSize(artifact.metadata.result)
        },
    };
}

function truncateResult(value: unknown, maxEntries: number, maxChars: number): unknown {
    if (Array.isArray(value)) {
        if (value.length <= maxEntries && estimateSize(value) <= maxChars) return value;
        const sliced = value.slice(0, maxEntries);
        return {entries: sliced, count: value.length, truncated: true};
    }
    if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const size = estimateSize(value);
        if (size <= maxChars) return value;
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj)) {
            if (Array.isArray(v) && v.length > maxEntries) {
                out[k] = {entries: v.slice(0, maxEntries), count: v.length, truncated: true};
            } else {
                out[k] = v;
            }
        }
        out.truncated = true;
        return out;
    }
    if (typeof value === 'string' && value.length > maxChars) {
        const suffix = '…[truncated]';
        const headroom = Math.max(0, maxChars - suffix.length);
        return value.slice(0, headroom) + suffix;
    }
    return value;
}

function estimateSize(value: unknown): number {
    try {
        return JSON.stringify(value).length;
    } catch {
        return Number.MAX_SAFE_INTEGER;
    }
}
