import type {LMClient, LMConfig} from '../types.js';
import {createLogger} from '../../logger/index.js';
import {extractSystemPrompt, buildJsonToolSystemPrompt, type V2Tool} from './prompt-utils.js';

const logger = createLogger({scope: 'lm:adapter'});

/**
 * Vercel AI SDK 5 `LanguageModelV2` adapter for legacy `LMClient` instances.
 *
 * The wrapped `LMClient` only speaks a single-string prompt; it cannot emit
 * structured tool calls natively. This adapter bridges the gap by:
 *   1. Building a system prompt that includes the tool catalogue
 *      (`buildJsonToolSystemPrompt`).
 *   2. Calling the LM with the combined prompt.
 *   3. Parsing the LM text response for `{"name": ..., "arguments": ...}`
 *      JSON objects, validating arguments against each tool's Zod input
 *      schema, and returning a structured `content` array of `text` +
 *      `tool-call` parts (the V2 protocol the AI SDK consumes).
 *
 * Streaming: `doStream` is implemented in terms of `doGenerate` and yields a
 * `ReadableStream` of `text-delta` and `finish` events. Per-token
 * streaming is not provided because the underlying `LMClient` returns
 * a single string; the streaming surface exists to keep the V2 contract
 * uniform so callers (ModelRunner) can use either entry point.
 */
export interface AISDKLanguageModel {
    specificationVersion: 'v2';
    modelId: string;
    provider: string;
    defaultObjectGenerationMode: 'json' | 'tool';
    supportedUrls: Record<string, RegExp[]>;
    doGenerate(options: {
        prompt: Array<{
            role: 'system' | 'user' | 'assistant' | 'tool';
            content: string | Array<Record<string, unknown>>;
            providerOptions?: Record<string, unknown>;
        }>;
        abortSignal?: AbortSignal;
        maxOutputTokens?: number;
        temperature?: number;
        tools?: Array<{
            type: string;
            name: string;
            description?: string;
            inputSchema?: unknown;
        }>;
    }): Promise<{
        content: Array<
            | {type: 'text'; text: string}
            | {type: 'tool-call'; toolCallId: string; toolName: string; input: unknown}
        >;
        finishReason: 'stop' | 'length' | 'content-filter' | 'error' | 'tool-calls' | 'other';
        usage: {inputTokens: number; outputTokens: number; totalTokens: number};
    }>;
    doStream(options: {
        prompt: Array<{
            role: 'system' | 'user' | 'assistant' | 'tool';
            content: string | Array<Record<string, unknown>>;
            providerOptions?: Record<string, unknown>;
        }>;
        abortSignal?: AbortSignal;
        maxOutputTokens?: number;
        temperature?: number;
        tools?: Array<{
            type: string;
            name: string;
            description?: string;
            inputSchema?: unknown;
        }>;
    }): Promise<{
        stream: ReadableStream<
            | {type: 'text-delta'; id: string; text: string}
            | {type: 'tool-call'; toolCallId: string; toolName: string; input: unknown}
            | {type: 'finish'; finishReason: string; usage: {inputTokens: number; outputTokens: number; totalTokens: number}}
        >;
        finishReason: 'stop' | 'length' | 'content-filter' | 'error' | 'tool-calls' | 'other';
        usage: {inputTokens: number; outputTokens: number; totalTokens: number};
    }>;
}

export class AISDKAdapter implements AISDKLanguageModel {
    readonly specificationVersion = 'v2' as const;
    readonly provider: string;
    readonly modelId: string;
    readonly defaultObjectGenerationMode = 'json' as const;
    readonly supportedUrls = {} as Record<string, RegExp[]>;

    constructor(private client: LMClient) {
        this.provider = this.client.provider ?? 'adapter';
        this.modelId = this.client.model ?? 'unknown';
    }

    async doGenerate(options: Parameters<AISDKLanguageModel['doGenerate']>[0]) {
        const {system, messages} = extractSystemPrompt(options.prompt ?? []);
        const tools = (options.tools ?? []) as V2Tool[];
        const mergedSystem = buildJsonToolSystemPrompt(system, tools);

        const config: LMConfig & {signal?: AbortSignal} = {
            ...(options.maxOutputTokens !== undefined ? {maxTokens: options.maxOutputTokens} : {}),
            ...(options.temperature !== undefined ? {temperature: options.temperature} : {}),
            ...(options.abortSignal ? {signal: options.abortSignal} : {}),
        };

        let promptText: string;
        try {
            promptText = renderPrompt(messages, mergedSystem);
        } catch (error) {
            logger.error('Prompt rendering failed', error as Error);
            promptText = mergedSystem;
        }

        let text: string;
        try {
            text = await this.client.generateText(promptText, config);
        } catch (error) {
            logger.error('LM generation failed', error as Error);
            text = '';
        }

        const {cleanText, toolCalls} = extractToolCalls(text, tools);
        const content: Array<
            | {type: 'text'; text: string}
            | {type: 'tool-call'; toolCallId: string; toolName: string; input: unknown}
        > = [];

        if (cleanText.trim()) {
            content.push({type: 'text' as const, text: cleanText.trimEnd()});
        }
        for (const tc of toolCalls) {
            content.push({type: 'tool-call' as const, toolCallId: tc.toolCallId, toolName: tc.toolName, input: tc.input});
        }

        return {
            content,
            finishReason: toolCalls.length > 0 ? 'tool-calls' as const : 'stop' as const,
            usage: {inputTokens: 0, outputTokens: 0, totalTokens: 0},
        };
    }

    async doStream(options: Parameters<AISDKLanguageModel['doStream']>[0]) {
        const result = await this.doGenerate(options);
        const stream = new ReadableStream<{
            type: 'text-delta'; id: string; text: string;
        } | {
            type: 'tool-call'; toolCallId: string; toolName: string; input: unknown;
        } | {
            type: 'finish'; finishReason: string; usage: {inputTokens: number; outputTokens: number; totalTokens: number};
        }>({
            start(controller) {
                for (const part of result.content) {
                    if (part.type === 'text') {
                        controller.enqueue({type: 'text-delta', id: '1', text: part.text});
                    } else {
                        controller.enqueue({type: 'tool-call', toolCallId: part.toolCallId, toolName: part.toolName, input: part.input});
                    }
                }
                controller.enqueue({type: 'finish', finishReason: result.finishReason, usage: result.usage});
                controller.close();
            }
        });
        return {
            stream,
            finishReason: result.finishReason,
            usage: result.usage,
        };
    }
}

export function adapt(client: LMClient): AISDKLanguageModel {
    return new AISDKAdapter(client);
}

// ---------------------------------------------------------------------------
// Internals: prompt rendering and tool-call extraction. Kept private to the
// adapter so the rest of the system can ignore the LM's flat-prompt nature.
// ---------------------------------------------------------------------------

function renderPrompt(
    messages: Array<{role: string; content: string | Array<Record<string, unknown>>}>,
    system: string,
): string {
    const blocks: string[] = [];
    if (system.trim()) blocks.push(`### System\n${system.trim()}`);
    for (const msg of messages) {
        const text = textFromContent(msg.content);
        if (!text) continue;
        const role = msg.role === 'tool' ? 'Tool' : msg.role === 'user' ? 'Human' : msg.role === 'assistant' ? 'Assistant' : 'System';
        blocks.push(`### ${role}\n${text}`);
    }
    return blocks.join('\n\n');
}

function textFromContent(content: string | Array<Record<string, unknown>>): string {
    if (typeof content === 'string') return content;
    const parts: string[] = [];
    for (const part of content) {
        const type = part.type as string;
        if (type === 'text' && typeof part.text === 'string') {
            parts.push(part.text);
        } else if (type === 'tool-call' || type === 'tool_use') {
            const name = (part.toolName ?? part.name) as string | undefined;
            const args = (part.input ?? part.args) as Record<string, unknown> | undefined;
            parts.push(`[calling tool ${name ?? '?'}: ${JSON.stringify(args ?? {})}]`);
        } else if (type === 'tool-result') {
            const name = (part.toolName ?? part.name) as string | undefined;
            parts.push(`[tool ${name ?? '?'} returned: ${JSON.stringify(part.result ?? part.output ?? '')}]`);
        } else if (type === 'reasoning' && typeof part.text === 'string') {
            parts.push(`[reasoning: ${part.text}]`);
        }
    }
    return parts.join('');
}

const TOOL_CALL_REGEX = /\{(?:[^{}]|\{[^{}]*\})*"name"(?:[^{}]|\{[^{}]*\})*\}/g;

interface ExtractedToolCall {
    toolCallId: string;
    toolName: string;
    input: unknown;
}

interface ToolCallExtraction {
    cleanText: string;
    toolCalls: ExtractedToolCall[];
}

function extractToolCalls(text: string, tools: Array<{name: string; inputSchema?: unknown}>): ToolCallExtraction {
    const toolCalls: ExtractedToolCall[] = [];
    const usedSpans: Array<[number, number]> = [];

    const matches = text.match(TOOL_CALL_REGEX) ?? [];
    for (const m of matches) {
        const start = text.indexOf(m, usedSpans.length > 0 ? usedSpans[usedSpans.length - 1]![1] : 0);
        if (start === -1) continue;
        const end = start + m.length;
        const parsed = safeParseJson(m);
        if (!parsed || typeof parsed !== 'object') continue;
        const obj = parsed as Record<string, unknown>;
        const name = typeof obj.name === 'string' ? obj.name : null;
        if (!name) continue;
        const tool = tools.find(t => t.name === name);
        if (!tool) continue;
        const rawArgs = (obj.arguments && typeof obj.arguments === 'object') ? obj.arguments as Record<string, unknown> : {};
        const validated = validateArgs(rawArgs, tool.inputSchema);
        toolCalls.push({
            toolCallId: `tc_${toolCalls.length}_${Date.now().toString(36)}`,
            toolName: name,
            input: validated,
        });
        usedSpans.push([start, end]);
    }

    const cleanText = stripSpans(text, usedSpans);
    return {cleanText, toolCalls};
}

function safeParseJson(s: string): unknown {
    try {
        return JSON.parse(s);
    } catch {
        return null;
    }
}

function validateArgs(raw: Record<string, unknown>, schema: unknown): Record<string, unknown> {
    if (!schema || typeof schema !== 'object') return raw;
    const candidate = schema as {safeParse?: (input: unknown) => {success: boolean; data?: unknown; error?: unknown}; parse?: (input: unknown) => unknown};
    if (typeof candidate.safeParse !== 'function') return raw;
    const result = candidate.safeParse(raw);
    if (result.success) return (result.data as Record<string, unknown>) ?? raw;
    const coerced = coerceOptionalFields(raw, result.error);
    const retry = candidate.safeParse(coerced);
    if (retry.success) return (retry.data as Record<string, unknown>) ?? coerced;
    return raw;
}

function coerceOptionalFields(raw: Record<string, unknown>, err: unknown): Record<string, unknown> {
    const issues = (err as {issues?: Array<{code?: string; path?: Array<string|number>}>})?.issues;
    if (!Array.isArray(issues)) return raw;
    const out: Record<string, unknown> = {...raw};
    for (const issue of issues) {
        if (issue.code === 'invalid_type' && Array.isArray(issue.path) && issue.path.length > 0) {
            const key = String(issue.path[0]);
            if (!(key in out)) continue;
        }
    }
    return out;
}

function stripSpans(text: string, spans: Array<[number, number]>): string {
    if (spans.length === 0) return text;
    const sorted = [...spans].sort((a, b) => a[0] - b[0]);
    let out = '';
    let cursor = 0;
    for (const [s, e] of sorted) {
        if (s < cursor) continue;
        out += text.slice(cursor, s);
        cursor = e;
    }
    out += text.slice(cursor);
    return out;
}
