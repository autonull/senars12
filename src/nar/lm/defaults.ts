/**
 * Default LM Configuration
 * Legacy compatibility layer — new code should use createSeNARSRegistry() from providers.ts
 */

import type {LMClient} from './types.js';
import type {ModelCapability, ModelRegistry, ModelRegistryEntry} from './model-registry.js';
import {defaultModelRegistry} from './model-registry.js';
import {createMockLMClient} from './mock-client.js';
import {createLogger} from '../logger/index.js';
import type {LanguageModel} from 'ai';
import {TransformersLMClient, DEFAULT_TRANSFORMERS_MODEL} from './transformers-client.js';

export const DEFAULT_COMPACT_MODEL = DEFAULT_TRANSFORMERS_MODEL;
export {TransformersLMClient};

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

class OllamaLMClient implements LMClient {
  readonly provider = 'ollama';
  readonly model: string;
  available = true;
  private modelInstance?: LanguageModel;
  private initializing?: Promise<void>;
  private readonly logger = createLogger({scope: 'lm:ollama'});

  constructor(modelId: string = 'llama3.2') {
    this.model = modelId;
  }

  async init(): Promise<void> {
    await this.ensureInitialized();
  }

  async generateText(prompt: string, _options?: any): Promise<string> {
    await this.ensureInitialized();
    if (!this.modelInstance) throw new Error('Ollama model not initialized');
    try {
      const result = await (this.modelInstance as any).doGenerate({inputFormat: 'prompt', mode: {type: 'regular'}, prompt: [{role: 'user', content: [{type: 'text', text: prompt}]}], rawPrompt: undefined});
      return result.content?.[0]?.text ?? '';
    } catch (error: any) {
      throw new Error(`Ollama generation failed: ${error.message}`);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.modelInstance) return;
    if (this.initializing) return this.initializing;
    this.initializing = (async () => {
      try {
        const {ollama} = await import('ollama-ai-provider-v2');
        this.modelInstance = ollama(this.model) as unknown as LanguageModel;
      } catch (error) {
        this.available = false;
        this.logger.error('Failed to initialize Ollama', error as Error);
        throw error;
      } finally {
        this.initializing = undefined;
      }
    })();
    return this.initializing;
  }
}

export function createTransformersEntry(): ModelRegistryEntry {
    return {
        id: 'transformers',
        config: {provider: 'transformers' as const, model: DEFAULT_COMPACT_MODEL, ...COMPACT_MODEL_CAPABILITY},
        clientFactory: () => new TransformersLMClient(DEFAULT_COMPACT_MODEL),
        enabled: true,
        priority: 1,
        stats: {totalCalls: 0, successfulCalls: 0, failedCalls: 0, averageLatency: 0},
    };
}

export function createOllamaEntry(): ModelRegistryEntry {
    const model = process.env.OLLAMA_MODEL || process.env.LM_MODEL || 'llama3.2';
    return {
        id: 'ollama',
        config: {provider: 'ollama' as const, model, ...OLLAMA_MODEL_CAPABILITY},
        clientFactory: () => new OllamaLMClient(model),
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

    const provider = process.env.LM_PROVIDER || 'transformers';

    if (provider === 'transformers') {
        const transformersEntry = registry.get('transformers');
        if (transformersEntry?.enabled) {
            try {
                logger.info('Using Transformers.js LM provider');
                return transformersEntry.clientFactory();
            } catch (error) {
                logger.debug(`Transformers.js failed (${(error as Error).message}), trying fallback`);
            }
        }
    }

    if (provider === 'ollama') {
        const ollamaEntry = registry.get('ollama');
        if (ollamaEntry?.enabled) {
            try {
                logger.info('Using Ollama LM provider');
                return ollamaEntry.clientFactory();
            } catch (error) {
                logger.debug(`Ollama failed (${(error as Error).message}), using mock`);
            }
        }
    }

    logger.warn(`Transformers.js unavailable, using fallback. Set LM_PROVIDER=mock to disable`);
    return createMockLMClient();
}

export function getTurnkeyConfig(): TurnkeyConfig {
    return {
        lm: {
            provider: 'transformers',
            model: DEFAULT_COMPACT_MODEL,
            device: 'cpu',
            quantized: true,
            temperature: 0.7,
            maxTokens: 256
        },
        fallbackChain: [...FALLBACK_CHAIN],
    };
}

export const TURNKEY_DEFAULTS = getTurnkeyConfig();

export function getProviderPriority(provider: ProviderType): number {
    const index = FALLBACK_CHAIN.indexOf(provider);
    return index === -1 ? 99 : index;
}

export function getNextFallback(current: ProviderType): ProviderType | null {
    const index = FALLBACK_CHAIN.indexOf(current);
    if (index === -1 || index >= FALLBACK_CHAIN.length - 1) return null;
    return FALLBACK_CHAIN[index + 1] ?? null;
}
