import type {LMClient, LMConfig} from '../types.js';
import {createLogger} from '../../logger/index.js';
import type {V2Tool} from './prompt-utils.js';
import {extractSystemPrompt, buildJsonToolSystemPrompt, formatV2Prompt} from './prompt-utils.js';

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
            promptText = formatV2Prompt(messages, mergedSystem);
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

        const usage = estimateUsage(promptText, text);

        return {
            content,
            finishReason: toolCalls.length > 0 ? 'tool-calls' as const : 'stop' as const,
            usage,
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
// Internals: tool-call extraction. Kept private to the
// adapter so the rest of the system can ignore the LM's flat-prompt nature.
// ---------------------------------------------------------------------------

const TOOL_CALL_MARKER = '"name"';

interface ExtractedToolCall {
    toolCallId: string;
    toolName: string;
    input: unknown;
}

interface ToolCallExtraction {
    cleanText: string;
    toolCalls: ExtractedToolCall[];
}

function findBalancedJsonObject(text: string, start: number): {end: number} | null {
    if (text[start] !== '{') return null;
    let depth = 1;
    for (let i = start + 1; i < text.length; i++) {
        const c = text[i];
        if (c === '{') depth++;
        else if (c === '}') {
            depth--;
            if (depth === 0) return {end: i + 1};
        }
    }
    return null;
}

function extractToolCalls(text: string, tools: Array<{name: string; inputSchema?: unknown}>): ToolCallExtraction {
    const toolCalls: ExtractedToolCall[] = [];
    const usedSpans: Array<[number, number]> = [];

    let cursor = 0;
    while (cursor < text.length) {
        const marker = text.indexOf(TOOL_CALL_MARKER, cursor);
        if (marker === -1) break;

        let braceStart = marker;
        while (braceStart > 0 && text[braceStart] !== '{') braceStart--;
        if (braceStart < cursor) {
            cursor = marker + TOOL_CALL_MARKER.length;
            continue;
        }

        const balanced = findBalancedJsonObject(text, braceStart);
        if (!balanced) {
            cursor = marker + TOOL_CALL_MARKER.length;
            continue;
        }

        const json = text.slice(braceStart, balanced.end);
        const parsed = safeParseJson(json);
        if (!parsed || typeof parsed !== 'object') {
            cursor = balanced.end;
            continue;
        }
        const obj = parsed as Record<string, unknown>;
        const name = typeof obj.name === 'string' ? obj.name : null;
        if (!name) {
            cursor = balanced.end;
            continue;
        }
        const tool = tools.find(t => t.name === name);
        if (!tool) {
            cursor = balanced.end;
            continue;
        }

        const rawArgs = (obj.arguments && typeof obj.arguments === 'object') ? obj.arguments as Record<string, unknown> : {};
        const validated = validateArgs(rawArgs, tool.inputSchema);
        toolCalls.push({
            toolCallId: `tc_${toolCalls.length}_${Date.now().toString(36)}`,
            toolName: name,
            input: validated,
        });
        usedSpans.push([braceStart, balanced.end]);
        cursor = balanced.end;
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
    const candidate = schema as {safeParse?: (input: unknown) => {success: boolean; data?: unknown; error?: unknown}; parse?: (input: unknown) => unknown; _zod?: {def?: {shape?: Record<string, unknown>}}};
    if (typeof candidate.safeParse !== 'function') return raw;
    const result = candidate.safeParse(raw);
    if (result.success) return (result.data as Record<string, unknown>) ?? raw;
    const coerced = coerceOptionalFields(raw, candidate);
    const retry = candidate.safeParse(coerced);
    if (retry.success) return (retry.data as Record<string, unknown>) ?? coerced;
    return coerced;
}

function coerceOptionalFields(raw: Record<string, unknown>, schema: unknown): Record<string, unknown> {
    const shape = (schema as {_zod?: {def?: {shape?: Record<string, unknown>}}})?._zod?.def?.shape;
    const knownKeys = shape && typeof shape === 'object' ? new Set(Object.keys(shape)) : null;
    if (!knownKeys) return raw;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
        if (knownKeys.has(k)) out[k] = v;
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

function estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.max(1, Math.ceil(text.length / 4));
}

function estimateUsage(prompt: string, response: string): {inputTokens: number; outputTokens: number; totalTokens: number} {
    const input = estimateTokens(prompt);
    const output = estimateTokens(response);
    return {inputTokens: input, outputTokens: output, totalTokens: input + output};
}
