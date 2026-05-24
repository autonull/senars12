import type {LMClient, LMConfig} from '../types.js';

export interface AISDKLanguageModel {
    specificationVersion: 'v2';
    modelId: string;
    provider: string;
    defaultObjectGenerationMode: 'json' | 'tool';
    supportedUrls: Record<string, RegExp[]>;
    doGenerate(options: {
        prompt: Array<{role: 'system' | 'user' | 'assistant'; content: Array<{type: 'text'; text: string}>}>;
        abortSignal?: AbortSignal;
        maxOutputTokens?: number;
    }): Promise<{
        content: Array<{type: 'text'; text: string}>;
        finishReason: 'stop' | 'length' | 'content-filter' | 'error';
        usage: {promptTokens: number; completionTokens: number};
    }>;
    doStream(options: {
        prompt: Array<{role: 'system' | 'user' | 'assistant'; content: Array<{type: 'text'; text: string}>}>;
        abortSignal?: AbortSignal;
        maxOutputTokens?: number;
    }): Promise<{
        stream: ReadableStream<{type: 'text'; text: string}>;
        finishReason: 'stop' | 'length' | 'content-filter' | 'error';
        usage: {promptTokens: number; completionTokens: number};
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

    async doGenerate(options: {
        prompt: Array<{role: 'system' | 'user' | 'assistant'; content: Array<{type: 'text'; text: string}>}>;
        abortSignal?: AbortSignal;
        maxOutputTokens?: number;
    }): Promise<{
        content: Array<{type: 'text'; text: string}>;
        finishReason: 'stop' | 'length' | 'content-filter' | 'error';
        usage: {promptTokens: number; completionTokens: number};
    }> {
        const prompt = options.prompt?.[0]?.content?.[0]?.text ?? '';
        const config: LMConfig = {
            maxTokens: options.maxOutputTokens,
        };
        const text = await this.client.generateText(prompt, {...config, signal: options.abortSignal});
        return {
            content: [{type: 'text', text}],
            finishReason: 'stop',
            usage: {promptTokens: 0, completionTokens: 0},
        };
    }

    async doStream(options: {
        prompt: Array<{role: 'system' | 'user' | 'assistant'; content: Array<{type: 'text'; text: string}>}>;
        abortSignal?: AbortSignal;
        maxOutputTokens?: number;
    }): Promise<{
        stream: ReadableStream<{type: 'text'; text: string}>;
        finishReason: 'stop' | 'length' | 'content-filter' | 'error';
        usage: {promptTokens: number; completionTokens: number};
    }> {
        const text = await this.doGenerate(options);
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue({type: 'text', text: text.content[0]?.text ?? ''});
                controller.close();
            }
        });
        return {
            stream,
            finishReason: text.finishReason,
            usage: text.usage,
        };
    }
}

export function adapt(client: LMClient): AISDKLanguageModel {
    return new AISDKAdapter(client);
}