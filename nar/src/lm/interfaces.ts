import type { LMGenerateOptions, LMService, LMTask } from '@senars/util';
import type { ZodSchema } from 'zod';
import type { ProviderSpend } from './lm-service.js';
import type { getCircuitBreaker } from './providers.js';

/**
 * Consumer-facing LM contract. Depend on this (not the concrete LMService)
 * at module boundaries so callers stay decoupled from provider wiring.
 *
 * util owns the shared surface, so a member added there — a new stat, a new
 * option on `generateText` — reaches every module boundary without a second
 * edit. Two members are narrowed rather than inherited: `generateObject` takes a
 * schema the caller actually validated (`util` types it `unknown` because the
 * LM layer does not care), and `getModel` accepts the per-call model override
 * this layer's routing chain supports.
 */
export interface ILMService extends Omit<LMService, 'generateObject' | 'getModel' | 'stream'> {
  getModel(task: LMTask, modelOverride?: string): ReturnType<LMService['getModel']>;

  generateObject<T>(prompt: string, schema: ZodSchema<T>, opts?: LMGenerateOptions): Promise<T>;

  stream(prompt: string, opts?: { task?: LMTask; signal?: AbortSignal }): AsyncIterable<string>;

  tryGenerateText(prompt: string, opts?: LMGenerateOptions): Promise<string | null>;

  getSpend(): Record<string, ProviderSpend>;
  getCircuitBreakerStatus(): Map<string, ReturnType<typeof getCircuitBreaker>>;
}
