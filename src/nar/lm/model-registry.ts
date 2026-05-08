import type {LMClient} from './types.js';

export type ModelProvider = 'anthropic' | 'openai' | 'ollama' | 'mock';

export interface ModelCapability {
  provider: ModelProvider;
  model: string;
  contextWindow: number;
  maxOutputTokens: number;
  speed: 'fast' | 'medium' | 'slow';
  cost: 'low' | 'medium' | 'high';
  quality: 'low' | 'medium' | 'high';
  supportsStructuredOutput: boolean;
}

export interface ModelRegistryEntry {
  id: string;
  config: ModelCapability;
  clientFactory: () => LMClient;
  enabled: boolean;
  priority: number;
  stats: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    averageLatency: number;
  };
}

export class ModelRegistry {
  private readonly models: Map<string, ModelRegistryEntry> = new Map();
  private fallbackChain: string[] = [];

  register(entry: ModelRegistryEntry): void {
    this.models.set(entry.id, entry);
  }

  unregister(id: string): void {
    this.models.delete(id);
  }

  enable(id: string): void {
    const entry = this.models.get(id);
    if (entry) {
      entry.enabled = true;
    }
  }

  disable(id: string): void {
    const entry = this.models.get(id);
    if (entry) {
      entry.enabled = false;
    }
  }

  get(id: string): ModelRegistryEntry | undefined {
    return this.models.get(id);
  }

  list(enabledOnly = false): ModelRegistryEntry[] {
    const entries = Array.from(this.models.values());
    return enabledOnly ? entries.filter(e => e.enabled) : entries;
  }

  setFallbackChain(chain: string[]): void {
    this.fallbackChain = chain;
  }

  async executeWithFallback<T>(
    primaryModelId: string,
    executor: (client: LMClient) => Promise<T>
  ): Promise<T> {
    const chain = this.fallbackChain.length > 0 
      ? this.fallbackChain 
      : [primaryModelId];

    let lastError: Error | null = null;

    for (const modelId of chain) {
      const entry = this.models.get(modelId);
      if (!entry || !entry.enabled) {
        continue;
      }

      try {
        const client = entry.clientFactory();
        const result = await executor(client);
        
        entry.stats.successfulCalls++;
        entry.stats.totalCalls++;
        
        return result;
      } catch (error) {
        entry.stats.failedCalls++;
        entry.stats.totalCalls++;
        lastError = error instanceof Error ? error : new Error(String(error));
        
        console.warn(`Model ${modelId} failed, trying fallback: ${lastError.message}`);
      }
    }

    throw lastError || new Error('All models in fallback chain failed');
  }

  selectModel(taskType: string): string | null {
    const enabled = this.list(true);
    if (enabled.length === 0) {
      return null;
    }

    let selected: string | undefined;
    switch (taskType) {
      case 'translation':
      case 'parsing':
        selected = enabled.find(e => e.config.speed === 'fast')?.id || enabled[0]?.id;
        break;
      
      case 'reasoning':
      case 'hypothesis':
        selected = enabled.find(e => e.config.quality === 'high')?.id || enabled[0]?.id;
        break;
      
      case 'decomposition':
      case 'planning':
        selected = enabled.find(e => 
          e.config.quality === 'high' || e.config.supportsStructuredOutput
        )?.id || enabled[0]?.id;
        break;
      
      default:
        selected = enabled[0]?.id;
    }
    
    return selected ?? null;
  }

  recordLatency(modelId: string, latency: number): void {
    const entry = this.models.get(modelId);
    if (entry) {
      const {averageLatency, totalCalls} = entry.stats;
      entry.stats.averageLatency = 
        (averageLatency * totalCalls + latency) / (totalCalls + 1);
    }
  }
}

export const defaultModelRegistry = new ModelRegistry();

export const createModelRegistry = (): ModelRegistry => new ModelRegistry();
