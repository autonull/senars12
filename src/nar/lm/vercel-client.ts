import {anthropic} from '@ai-sdk/anthropic';
import {generateText} from 'ai';
import type {LMConfig} from './types.js';
import {BaseLMClient} from './base-client.js';

export interface VercelLMConfig extends LMConfig {
    provider?: 'anthropic' | 'openai';
    model?: string;
}

export class VercelLMClient extends BaseLMClient {
    private readonly model: ReturnType<typeof anthropic>;
    private config: VercelLMConfig;

    constructor(config: VercelLMConfig = {}) {
        super();
        this.config = {
            provider: config.provider || 'anthropic',
            model: config.model || 'claude-3-5-sonnet-20241022',
            temperature: config.temperature ?? 0.7,
            maxTokens: config.maxTokens ?? 1024,
            apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY || '',
        };

        const modelId = this.config.model || 'claude-3-5-sonnet-20241022';
        this.model = anthropic(modelId);
    }

    protected executeGenerate(prompt: string, options?: LMConfig): Promise<string> {
        return generateText({
            model: this.model,
            prompt,
            temperature: options?.temperature ?? this.config.temperature,
            maxOutputTokens: (options?.maxTokens ?? this.config.maxTokens) as number,
        }).then(({text}) => text);
    }
}

export const createVercelLMClient = (config?: VercelLMConfig): VercelLMClient => {
    return new VercelLMClient(config);
};
