import type {LMClient, LMConfig, LMExecutionStats} from './types.js';
import type {ModelRegistryEntry} from './model-registry.js';

export interface CacheEntry {
  response: string;
  timestamp: number;
  ttl: number;
  tokens: number;
  cost: number;
}

export interface CacheConfig {
  enabled: boolean;
  ttlMs: number;
  maxSize: number;
  costPerToken: number;
}

export class EnhancedLMClient implements LMClient {
  private readonly baseClient: LMClient;
  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly cacheConfig: CacheConfig;
  private readonly modelEntry?: ModelRegistryEntry;
  private stats: LMExecutionStats = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    totalDuration: 0,
    totalTokens: 0,
    averageDuration: 0,
    successRate: 0,
    totalCost: 0,
    averageCost: 0
  };

  constructor(
    baseClient: LMClient,
    cacheConfig: Partial<CacheConfig> = {},
    modelEntry?: ModelRegistryEntry
  ) {
    this.baseClient = baseClient;
    this.modelEntry = modelEntry;
    this.cacheConfig = {
      enabled: cacheConfig.enabled ?? true,
      ttlMs: cacheConfig.ttlMs ?? 3600000,
      maxSize: cacheConfig.maxSize ?? 1000,
      costPerToken: cacheConfig.costPerToken ?? 0.000001
    };
  }

  async generateText(prompt: string, options?: LMConfig): Promise<string> {
    return this.generateTextWithCache(prompt, options);
  }

  async generateTextWithCache(prompt: string, options?: LMConfig): Promise<string> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(prompt, options);

    const cached = this.getCachedResponse(prompt);
    if (cached) {
      this.recordExecution(true, Date.now() - startTime, cacheKey.length, 0);
      return cached;
    }

    try {
      const response = await this.baseClient.generateText(prompt, options);
      const duration = Date.now() - startTime;
      const tokens = this.estimateTokens(response);
      const cost = tokens * this.cacheConfig.costPerToken;

      this.setCachedResponse(prompt, response, tokens, cost);
      this.recordExecution(true, duration, tokens, cost);

      return response;
    } catch (error) {
      this.recordExecution(false, Date.now() - startTime, 0, 0);
      throw error;
    }
  }

  getCachedResponse(prompt: string): string | undefined {
    const cacheKey = this.generateCacheKey(prompt, undefined);
    const entry = this.cache.get(cacheKey);

    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(cacheKey);
      return undefined;
    }

    return entry.response;
  }

  setCachedResponse(prompt: string, response: string, tokens: number, cost: number): void {
    if (!this.cacheConfig.enabled) return;

    if (this.cache.size >= this.cacheConfig.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    const cacheKey = this.generateCacheKey(prompt, undefined);
    this.cache.set(cacheKey, {
      response,
      timestamp: Date.now(),
      ttl: this.cacheConfig.ttlMs,
      tokens,
      cost
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCost(): {tokens: number; cost: number} {
    return {
      tokens: this.stats.totalTokens,
      cost: this.stats.totalCost
    };
  }

  getStats(): LMExecutionStats {
    return this.stats;
  }

  resetStats(): void {
    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      totalDuration: 0,
      totalTokens: 0,
      averageDuration: 0,
      successRate: 0,
      totalCost: 0,
      averageCost: 0
    };
  }

  private generateCacheKey(prompt: string, options?: LMConfig): string {
    const configStr = options ? JSON.stringify(options) : '';
    return `${prompt}:${configStr}`;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private recordExecution(success: boolean, duration: number, tokens: number, cost: number): void {
    this.stats.totalCalls++;
    this.stats.successfulCalls += success ? 1 : 0;
    this.stats.failedCalls += success ? 0 : 1;
    this.stats.totalDuration += duration;
    this.stats.totalTokens += tokens;
    this.stats.totalCost += cost;
    this.stats.averageDuration = this.stats.totalDuration / this.stats.totalCalls;
    this.stats.successRate = this.stats.successfulCalls / this.stats.totalCalls;
    this.stats.averageCost = this.stats.totalCost / this.stats.totalCalls;
  }
}

export const createEnhancedLMClient = (
  baseClient: LMClient,
  cacheConfig?: Partial<CacheConfig>,
  modelEntry?: ModelRegistryEntry
): EnhancedLMClient => {
  return new EnhancedLMClient(baseClient, cacheConfig, modelEntry);
};

export class FallbackLMClient implements LMClient {
  private readonly clients: Array<{client: LMClient; priority: number}> = [];
  private stats: Map<string, LMExecutionStats> = new Map();

  addClient(client: LMClient, priority: number = 0): void {
    this.clients.push({client, priority});
    this.clients.sort((a, b) => a.priority - b.priority);
  }

  async generateText(prompt: string, options?: LMConfig): Promise<string> {
    let lastError: Error | null = null;

    for (const {client} of this.clients) {
      try {
        const result = await client.generateText(prompt, options);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`Client failed, trying fallback: ${lastError.message}`);
      }
    }

    throw lastError || new Error('All fallback clients failed');
  }

  getStats(clientId: string): LMExecutionStats | undefined {
    return this.stats.get(clientId);
  }
}

export const createFallbackLMClient = (): FallbackLMClient => {
  return new FallbackLMClient();
};
