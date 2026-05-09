import {Ollama} from 'ollama';
import type {LMConfig} from './types.js';
import {BaseLMClient} from './base-client.js';

export interface OllamaLMConfig extends LMConfig {
    model?: string;
    baseUrl?: string;
}

export class OllamaLMClient extends BaseLMClient {
    private client: InstanceType<typeof Ollama>;
    private config: OllamaLMConfig;

    constructor(config: OllamaLMConfig = {}) {
        super();
        this.config = {
            model: config.model || 'llama3.2',
            baseUrl: config.baseUrl || 'http://localhost:11434',
            temperature: config.temperature ?? 0.7,
            maxTokens: config.maxTokens ?? 1024,
        };

        this.client = new Ollama({
            host: this.config.baseUrl,
        });
    }

    protected executeGenerate(prompt: string, options?: LMConfig): Promise<string> {
        return this.client.generate({
            model: this.config.model || 'llama3.2',
            prompt,
            options: {
                temperature: options?.temperature ?? this.config.temperature ?? 0.7,
                num_predict: options?.maxTokens ?? this.config.maxTokens ?? 1024,
            },
        }).then(r => r.response);
    }
}

export const createOllamaLMClient = (config?: OllamaLMConfig): OllamaLMClient => {
    return new OllamaLMClient(config);
};
