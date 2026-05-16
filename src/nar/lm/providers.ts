import {createProviderRegistry, customProvider, defaultSettingsMiddleware, wrapLanguageModel} from 'ai';
import {anthropic} from '@ai-sdk/anthropic';
import {ollama} from 'ollama-ai-provider-v2';
import {transformersJS} from '@browser-ai/transformers-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ollamaProvider = ollama as any;

export function createSeNARSRegistry() {
    return createProviderRegistry({
        cloud: customProvider({
            languageModels: {
                quality: wrapLanguageModel({
                    model: anthropic('claude-sonnet-4-20250514'),
                    middleware: defaultSettingsMiddleware({
                        settings: {maxOutputTokens: 2048, temperature: 0.3},
                    }),
                }),
                fast: anthropic('claude-haiku-4-20240307'),
            },
            fallbackProvider: anthropic,
        }),

        local: customProvider({
            languageModels: {
                quality: ollamaProvider('llama3.1:8b'),
                fast: ollamaProvider('llama3.2:3b'),
                compact: ollamaProvider('phi3:3.8b'),
            },
        }),

        builtin: customProvider({
            languageModels: {
                compact: transformersJS('HuggingFaceTB/SmolLM2-360M-Instruct', {device: 'cpu'}),
            },
        }),
    });
}

export type SeNARSRegistry = ReturnType<typeof createSeNARSRegistry>;

export function getQualityModel(registry: SeNARSRegistry) {
    return registry.languageModel('cloud:quality')
        ?? registry.languageModel('local:quality')
        ?? registry.languageModel('builtin:compact');
}

export function getFastModel(registry: SeNARSRegistry) {
    return registry.languageModel('cloud:fast')
        ?? registry.languageModel('local:fast')
        ?? registry.languageModel('builtin:compact');
}

export function getStructuredModel(registry: SeNARSRegistry) {
    return registry.languageModel('cloud:quality')
        ?? registry.languageModel('local:quality');
}

export function getModelForTask(registry: SeNARSRegistry, task: 'quality' | 'fast' | 'structured') {
    switch (task) {
        case 'quality':
            return getQualityModel(registry);
        case 'fast':
            return getFastModel(registry);
        case 'structured':
            return getStructuredModel(registry);
    }
}
