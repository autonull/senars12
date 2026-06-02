import type {LMClient, LMConfig} from '../types.js';
import {createLogger} from '../../logger/index.js';
import {extractSystemPrompt, buildJsonToolSystemPrompt, formatV2Prompt} from './prompt-utils.js';

const logger = createLogger({scope: 'lm:adapter'});

/**
 * Vercel AI SDK 5 `LanguageModelV2` adapter for legacy `LMClient` instances.
 *
 * The V2 specification the AI SDK hands us carries a `prompt: LanguageModelV2Prompt`
 * whose messages have a per-role `content` shape:
 *   - `system` -> string
 *   - `user` / `assistant` -> array of text/file/tool parts
 *   - `tool` -> array of tool-result parts
 *
 * A naïve flatten will crash on system messages. We delegate the structural
 * translation to `prompt-utils` and only concern ourselves here with
 * dispatching to the wrapped `LMClient` and shaping the V2 response.
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
        content: Array<{type: 'text'; text: string}>;
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
    }): Promise<{
        stream: ReadableStream<{type: 'text'; text: string}>;
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
        const {messages, system} = extractSystemPrompt(options.prompt ?? []);
        const tools = options.tools ?? [];
        const mergedSystem = buildJsonToolSystemPrompt(system, tools);
        const promptText = formatV2Prompt(messages, mergedSystem);

        const config: LMConfig = {
            maxTokens: options.maxOutputTokens,
            temperature: options.temperature,
        };

        let text: string;
        try {
            text = await this.client.generateText(promptText, {...config, signal: options.abortSignal});
        } catch (error) {
            logger.error('LM generation failed', error as Error);
            text = '';
        }

        return {
            content: [{type: 'text' as const, text}],
            finishReason: 'stop' as const,
            usage: {inputTokens: 0, outputTokens: 0, totalTokens: 0},
        };
    }

    async doStream(options: Parameters<AISDKLanguageModel['doStream']>[0]) {
        const result = await this.doGenerate(options);
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue({type: 'text', text: result.content[0]?.text ?? ''});
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
