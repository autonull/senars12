import type { LanguageModel } from 'ai';
import type { ZodSchema } from 'zod';
import type { LMExecutionStats, LMTask } from '@senars/util';
import type { ProviderSpend } from './lm-service.js';
import type { getCircuitBreaker } from './providers.js';

/**
 * Consumer-facing LM contract. Depend on this (not the concrete LMService)
 * at module boundaries so callers stay decoupled from provider wiring.
 */
export interface ILMService {
  readonly provider: string | undefined;
  readonly model: string | undefined;
  readonly available: boolean;

  getModel(task: LMTask, modelOverride?: string): LanguageModel | undefined;
  hasModel(): boolean;
  getStats(): LMExecutionStats;

  generateText(
    prompt: string,
    opts?: {
      task?: LMTask;
      signal?: AbortSignal;
      temperature?: number;
      maxOutputTokens?: number;
      model?: string;
      grammar?: string;
    }
  ): Promise<string>;

  tryGenerateText(prompt: string, opts?: Parameters<ILMService['generateText']>[1]): Promise<string | null>;

  generateObject<T>(
    prompt: string,
    schema: ZodSchema<T>,
    opts?: { task?: LMTask; signal?: AbortSignal; temperature?: number; model?: string }
  ): Promise<T>;

  stream(prompt: string, opts?: { task?: LMTask; signal?: AbortSignal }): AsyncIterable<string>;

  getSpend(): Record<string, ProviderSpend>;
  getCircuitBreakerStatus(): Map<string, ReturnType<typeof getCircuitBreaker>>;
}
