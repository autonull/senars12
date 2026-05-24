/**
 * Default LM Configuration
 * Legacy compatibility layer — new code should use createSeNARSRegistry() from providers.ts
 */

import type {LMClient, LMClientStats} from './types.js';
import type {ModelCapability, ModelRegistry, ModelRegistryEntry} from './model-registry.js';
import {defaultModelRegistry} from './model-registry.js';
import {createMockLMClient} from './mock-client.js';
import {createLogger} from '../logger/index.js';
import type {LanguageModel} from 'ai';

export const DEFAULT_COMPACT_MODEL = 'Xenova/gpt-2';

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

class TransformersLMClient implements LMClient {
  readonly provider = 'transformers';
  readonly model: string;
  available = true;
  private modelInstance?: any;
  private initializing?: Promise<void>;
  private queue: Array<() => void> = [];
  private running = 0;
  private readonly maxConcurrent = 1;
  private readonly inferenceTimeoutMs = 120000;
  private stats: LMClientStats = {totalCalls: 0, successfulCalls: 0, failedCalls: 0, timeoutCount: 0, totalDuration: 0, averageDuration: 0, queueDepth: 0, queueHighWater: 0};
  private readonly logger = createLogger({scope: 'lm:transformers'});

  constructor(modelId: string = DEFAULT_COMPACT_MODEL) {
    this.model = modelId;
  }

  async init(): Promise<void> {
    await this.ensureInitialized();
  }

  getStats(): LMClientStats {
    return {...this.stats, queueDepth: this.queue.length};
  }

  private async acquire(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (this.running < this.maxConcurrent) {
      this.running++;
      return;
    }
    this.stats.queueHighWater = Math.max(this.stats.queueHighWater, this.queue.length + 1);
    return new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        const idx = this.queue.findIndex(r => r === inner);
        if (idx !== -1) this.queue.splice(idx, 1);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      const inner = () => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      };
      if (signal) signal.aborted ? reject(new DOMException('Aborted', 'AbortError')) : signal.addEventListener('abort', onAbort, {once: true});
      this.queue.push(inner);
    });
  }

  private release(): void {
    this.queue.shift()?.();
    this.running--;
  }

  async generateText(prompt: string, options?: { signal?: AbortSignal }): Promise<string> {
    if (!this.available) return '';
    const startTime = Date.now();
    this.stats.totalCalls++;
    this.logger.debug('generateText', {promptLen: prompt.length, queueDepth: this.queue.length});

    try {
      await this.ensureInitialized();
      await this.acquire(options?.signal);
      if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (!this.modelInstance) throw new Error('Transformers.js model not initialized');

      const result = await Promise.race([
        this.modelInstance.doGenerate({
          prompt: [{role: 'user', content: [{type: 'text', text: prompt}]}],
          maxOutputTokens: 128,
          temperature: 0.7,
        }),
        this.timeoutPromise(this.inferenceTimeoutMs, options?.signal),
      ]);
      this.recordSuccess(Date.now() - startTime);
      return result.content?.[0]?.text ?? '';
    } catch (error: any) {
      const dur = Date.now() - startTime;
      this.recordFailure(error, dur);
      if (error.name === 'AbortError') throw error;
      this.available = false;
      this.logger.warn('generateText failed, LM unavailable', {duration: dur, error: error.message});
      return '';
    } finally {
      this.release();
    }
  }

  private timeoutPromise(ms: number, signal?: AbortSignal): Promise<never> {
    return new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error('Transformers.js call timed out')), ms);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      }, {once: true});
    });
  }

  private recordSuccess(dur: number): void {
    this.stats.successfulCalls++;
    this.stats.totalDuration += dur;
    this.stats.averageDuration = this.stats.totalDuration / this.stats.totalCalls;
    this.logger.debug('generateText ok', {duration: dur});
  }

  private recordFailure(error: any, dur: number): void {
    this.stats.totalDuration += dur;
    this.stats.averageDuration = this.stats.totalDuration / this.stats.totalCalls;
    const isAbort = error.name === 'AbortError';
    if (!isAbort) {
      this.stats.timeoutCount++;
    }
    this.stats.failedCalls++;
    this.logger.warn(isAbort ? 'generateText aborted' : 'generateText failed', {duration: dur, ...(isAbort ? {} : {error: error.message})});
  }

  private async ensureInitialized(): Promise<void> {
    if (this.modelInstance) return;
    if (this.initializing) return this.initializing;
    this.initializing = (async () => {
      try {
        const {transformersJS} = await import('@browser-ai/transformers-js');
        const model = transformersJS(this.model, {device: 'cpu'}) as any;
        this.logger.info('Loading Transformers.js model (may download weights on first run)...');
        await model.createSessionWithProgress?.((p: { progress: number }) => {
          const pct = Math.round(p.progress * 100);
          if (pct % 10 === 0) this.logger.info(`Model download: ${pct}%`);
        });
        this.modelInstance = model;
        this.logger.info('Transformers.js model ready');
      } catch (error) {
        this.available = false;
        this.logger.error('Failed to initialize Transformers.js', error as Error);
        throw error;
      } finally {
        this.initializing = undefined;
      }
    })();
    return this.initializing;
  }
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
    return {
        id: 'ollama',
        config: {provider: 'ollama' as const, model: 'llama3.2', ...OLLAMA_MODEL_CAPABILITY},
        clientFactory: () => new OllamaLMClient('llama3.2'),
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
