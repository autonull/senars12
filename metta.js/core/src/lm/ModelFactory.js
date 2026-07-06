/**
 * @file ModelFactory.js
 * @description Factory for creating different LangChain models based on provider
 */

import {ChatOllama} from '@langchain/ollama';
import {ChatOpenAI} from '@langchain/openai';

export class ModelFactory {
    static createModel(providerType, config) {
        const modelCreators = {
            'ollama': (cfg) => new ChatOllama({
                model: cfg.modelName,
                baseUrl: cfg.baseURL,
                temperature: cfg.temperature,
                num_predict: cfg.maxTokens,
                ...cfg.ollamaOptions
            }),
            'openai': (cfg) => {
                if (!cfg.apiKey) {
                    throw new Error('API key is required for OpenAI provider');
                }
                return new ChatOpenAI({
                    modelName: cfg.modelName,
                    openAIApiKey: cfg.apiKey,
                    temperature: cfg.temperature,
                    maxTokens: cfg.maxTokens,
                    ...cfg.openaiOptions
                });
            }
        };

        const creator = modelCreators[providerType];
        if (!creator) {
            throw new Error(`Unsupported provider type: ${providerType}. Use 'ollama' or 'openai'.`);
        }

        return creator(config);
    }
}