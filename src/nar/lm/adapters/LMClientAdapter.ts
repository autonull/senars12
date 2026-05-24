import type {LMClient, LMConfig} from '../types.js';

export interface LMClientAdapterOptions {
    defaultModel?: string;
    defaultProvider?: string;
}

export class LMClientAdapter implements LMClient {
    readonly provider?: string;
    readonly model?: string;
    available = true;

    constructor(
        private languageModel: {
            readonly provider: string;
            readonly modelId: string;
            doGenerate(options: {
                prompt: Array<{role: 'system' | 'user' | 'assistant'; content: Array<{type: 'text'; text: string}>}>;
                abortSignal?: AbortSignal;
                maxOutputTokens?: number;
            }): Promise<{
                content: Array<{type: 'text'; text: string}>;
                finishReason: 'stop' | 'length' | 'content-filter' | 'error';
                usage: {promptTokens: number; completionTokens: number};
            }>;
        },
        options?: LMClientAdapterOptions
    ) {
        this.provider = options?.defaultProvider ?? languageModel.provider;
        this.model = options?.defaultModel ?? languageModel.modelId;
    }

    async generateText(prompt: string, options?: LMConfig & {signal?: AbortSignal}): Promise<string> {
        const result = await this.languageModel.doGenerate({
            prompt: [{role: 'user', content: [{type: 'text', text: prompt}]}],
            abortSignal: options?.signal,
            maxOutputTokens: options?.maxTokens,
        });
        return result.content[0]?.text ?? '';
    }
}

export function adaptLanguageModel(
    languageModel: {
        readonly provider: string;
        readonly modelId: string;
        doGenerate(options: {
            prompt: Array<{role: 'system' | 'user' | 'assistant'; content: Array<{type: 'text'; text: string}>}>;
            abortSignal?: AbortSignal;
            maxOutputTokens?: number;
        }): Promise<{
            content: Array<{type: 'text'; text: string}>;
            finishReason: 'stop' | 'length' | 'content-filter' | 'error';
            usage: {promptTokens: number; completionTokens: number};
        }>;
    },
    options?: LMClientAdapterOptions
): LMClient {
    return new LMClientAdapter(languageModel, options);
}