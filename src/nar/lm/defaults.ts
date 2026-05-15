/**
 * Default LM Configuration
 * Legacy compatibility layer — new code should use createSeNARSRegistry() from providers.ts
 */

import type {LMClient} from './types.js';
import type {ModelCapability, ModelRegistryEntry, ModelRegistry} from './model-registry.js';
import {createMockLMClient} from './mock-client.js';
import {defaultModelRegistry} from './model-registry.js';
import {createLogger} from '../logger/index.js';

export const DEFAULT_COMPACT_MODEL = 'Xenova/LaMini-Flan-T5-77M';

export const COMPACT_MODEL_CAPABILITY: Omit<ModelCapability, 'provider' | 'model'> = {
    contextWindow: 128000,
    maxOutputTokens: 256,
    speed: 'medium',
    cost: 'low',
    quality: 'medium',
    supportsStructuredOutput: false,
};

export const OLLAMA_MODEL_CAPABILITY: Omit<ModelCapability, 'provider' | 'model'> = {
    contextWindow: 128000,
    maxOutputTokens: 2048,
    speed: 'medium',
    cost: 'low',
    quality: 'high',
    supportsStructuredOutput: true,
};

export const MOCK_MODEL_CAPABILITY: Omit<ModelCapability, 'provider' | 'model'> = {
    contextWindow: 0,
    maxOutputTokens: 0,
    speed: 'fast',
    cost: 'low',
    quality: 'low',
    supportsStructuredOutput: false,
};

export const FALLBACK_CHAIN = ['transformers', 'ollama', 'mock'] as const;

export type ProviderType = typeof FALLBACK_CHAIN[number];

export interface TurnkeyConfig {
    lm: {
        provider: ProviderType;
        model: string;
        device: 'webgpu' | 'wasm' | 'cpu';
        quantized: boolean;
        temperature: number;
        maxTokens: number;
    };
    fallbackChain: readonly ProviderType[];
}

export function createTransformersEntry(): ModelRegistryEntry {
    return {
        id: 'transformers',
        config: {provider: 'transformers' as const, model: DEFAULT_COMPACT_MODEL, ...COMPACT_MODEL_CAPABILITY},
        clientFactory: () => createMockLMClient(),
        enabled: true,
        priority: 1,
        stats: {totalCalls: 0, successfulCalls: 0, failedCalls: 0, averageLatency: 0},
    };
}

export function createOllamaEntry(): ModelRegistryEntry {
    return {
        id: 'ollama',
        config: {provider: 'ollama' as const, model: 'llama3.2', ...OLLAMA_MODEL_CAPABILITY},
        clientFactory: () => createMockLMClient(),
        enabled: true,
        priority: 2,
        stats: {totalCalls: 0, successfulCalls: 0, failedCalls: 0, averageLatency: 0},
    };
}

export function createMockEntry(): ModelRegistryEntry {
    return {
        id: 'mock',
        config: {provider: 'mock' as const, model: 'default', ...MOCK_MODEL_CAPABILITY},
        clientFactory: () => createMockLMClient(),
        enabled: true,
        priority: 99,
        stats: {totalCalls: 0, successfulCalls: 0, failedCalls: 0, averageLatency: 0},
    };
}

export function registerDefaultModels(registry: ModelRegistry = defaultModelRegistry): void {
    registry.register(createTransformersEntry());
    registry.register(createOllamaEntry());
    registry.register(createMockEntry());
    registry.setFallbackChain([...FALLBACK_CHAIN]);
}

export function createDefaultLMClient(): LMClient {
    return createMockLMClient();
}

export function setupDefaultLMClient(registry: ModelRegistry = defaultModelRegistry): LMClient {
    registerDefaultModels(registry);
    const logger = createLogger({scope: 'lm:defaults'});
    const transformersEntry = registry.get('transformers');
    if (transformersEntry?.enabled) {
        try {
            return transformersEntry.clientFactory();
        } catch {
            logger.debug('Transformers.js failed, trying fallback');
        }
    }
    const ollamaEntry = registry.get('ollama');
    if (ollamaEntry?.enabled) {
        try {
            return ollamaEntry.clientFactory();
        } catch {
            logger.debug('Ollama failed, using mock');
        }
    }
    return createMockLMClient();
}

export function getTurnkeyConfig(): TurnkeyConfig {
    return {
        lm: {provider: 'transformers', model: DEFAULT_COMPACT_MODEL, device: 'cpu', quantized: true, temperature: 0.7, maxTokens: 256},
        fallbackChain: [...FALLBACK_CHAIN],
    };
}

export function isTransformersAvailable(): boolean {
    return true;
}

export const TURNKEY_DEFAULTS = getTurnkeyDefaults();

function getTurnkeyDefaults(): TurnkeyConfig {
    return {
        lm: {provider: 'transformers' as const, model: DEFAULT_COMPACT_MODEL, device: 'cpu' as const, quantized: true, temperature: 0.7, maxTokens: 256},
        fallbackChain: [...FALLBACK_CHAIN],
    };
}

export function createLMClientFromConfig(_provider: ProviderType): LMClient {
    return createMockLMClient();
}

export function getProviderPriority(provider: ProviderType): number {
    const index = FALLBACK_CHAIN.indexOf(provider);
    return index === -1 ? 99 : index;
}

export function getNextFallback(current: ProviderType): ProviderType | null {
    const index = FALLBACK_CHAIN.indexOf(current);
    if (index === -1 || index >= FALLBACK_CHAIN.length - 1) return null;
    return FALLBACK_CHAIN[index + 1] ?? null;
}
