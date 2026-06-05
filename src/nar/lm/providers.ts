import {createProviderRegistry, customProvider, defaultSettingsMiddleware, wrapLanguageModel} from 'ai';
import {anthropic} from '@ai-sdk/anthropic';
import {ollama} from 'ollama-ai-provider-v2';
import {transformersJS} from '@browser-ai/transformers-js';
import {resolveLMConfig} from './env-config.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ollamaProvider = ollama as any;

export const BUILTIN_CHAT_MODEL = 'Xenova/gpt-2';
export const BUILTIN_COMPACT_MODEL = 'Xenova/gpt-2';

const OLLAMA_QUALITY_DEFAULT = 'llama3.1:8b';
const OLLAMA_FAST_DEFAULT = 'llama3.2:3b';
const OLLAMA_COMPACT_DEFAULT = 'phi3:3.8b';
const ANTHROPIC_QUALITY_DEFAULT = 'claude-sonnet-4-20250514';
const ANTHROPIC_FAST_DEFAULT = 'claude-haiku-4-20240307';

export function createSeNARSRegistry() {
    const cfg = resolveLMConfig();
    const ollamaQuality = cfg.host ? ollamaProvider(cfg.model, {baseURL: `${cfg.host}/v1`}) : ollamaProvider(OLLAMA_QUALITY_DEFAULT);
    const ollamaFast = cfg.host ? ollamaProvider(OLLAMA_FAST_DEFAULT, {baseURL: `${cfg.host}/v1`}) : ollamaProvider(OLLAMA_FAST_DEFAULT);
    const ollamaCompact = cfg.host ? ollamaProvider(OLLAMA_COMPACT_DEFAULT, {baseURL: `${cfg.host}/v1`}) : ollamaProvider(OLLAMA_COMPACT_DEFAULT);

    return createProviderRegistry({
        cloud: customProvider({
            languageModels: {
                quality: wrapLanguageModel({
                    model: anthropic(ANTHROPIC_QUALITY_DEFAULT),
                    middleware: defaultSettingsMiddleware({
                        settings: {maxOutputTokens: 2048, temperature: 0.3},
                    }),
                }),
                fast: anthropic(ANTHROPIC_FAST_DEFAULT),
            },
            fallbackProvider: anthropic,
        }),

        local: customProvider({
            languageModels: {
                quality: ollamaQuality,
                fast: ollamaFast,
                compact: ollamaCompact,
            },
        }),

        builtin: customProvider({
            languageModels: {
                quality: transformersJS(BUILTIN_CHAT_MODEL, {device: 'cpu'}),
                compact: transformersJS(BUILTIN_COMPACT_MODEL, {device: 'cpu'}),
            },
        }),
    });
}

export type SeNARSRegistry = ReturnType<typeof createSeNARSRegistry>;

let _providerRegistry: SeNARSRegistry | undefined;

export function getProviderRegistry(): SeNARSRegistry {
    if (!_providerRegistry) {
        _providerRegistry = createSeNARSRegistry();
    }
    return _providerRegistry;
}

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
