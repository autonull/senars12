import type { LanguageModel } from 'ai';

export type LMTask = 'quality' | 'fast' | 'structured';

export interface LMExecutionStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalDuration: number;
  totalTokens: number;
  averageDuration: number;
  successRate: number;
  totalCost: number;
  averageCost: number;
}

export interface LMService {
  readonly provider: string | undefined;
  readonly model: string | undefined;
  readonly available: boolean;

  getModel(task: LMTask): LanguageModel | undefined;
  hasModel(): boolean;
  getStats(): LMExecutionStats;

  generateText(
    prompt: string,
    opts?: {
      task?: LMTask;
      signal?: AbortSignal;
      temperature?: number;
      maxOutputTokens?: number;
    }
  ): Promise<string>;

  generateObject<T>(
    prompt: string,
    schema: unknown,
    opts?: {
      task?: LMTask;
      signal?: AbortSignal;
    }
  ): Promise<T>;

  stream(
    prompt: string,
    opts?: {
      task?: LMTask;
      signal?: AbortSignal;
    }
  ): AsyncIterable<string>;
}

export type LMRuleStats = {
  id: string;
  name: string;
  enabled: boolean;
  stats: LMExecutionStats;
  circuitState: 'closed' | 'open' | 'half-open';
};

export type LMRuleConfig = {
  id?: string;
  name?: string;
  description?: string;
  category?: string;
  priority?: number;
  enabled?: boolean;
  singlePremise?: boolean;
  promptTemplate?:
    | string
    | ((primary: unknown, secondary?: unknown, context?: Record<string, unknown>) => string);
  responseProcessor?: (
    response: unknown,
    primary: unknown,
    secondary?: unknown,
    context?: Record<string, unknown>
  ) => unknown;
  taskGenerator?: (
    processed: unknown,
    primary: unknown,
    secondary?: unknown,
    context?: Record<string, unknown>
  ) => unknown[];
  activationCondition?: (
    primary: unknown,
    secondary?: unknown,
    context?: Record<string, unknown>
  ) => boolean;
  lmOptions?: {
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
  };
};

export type LMPromptGenerator = (
  primary: unknown,
  secondary?: unknown,
  context?: Record<string, unknown>
) => string;
export type LMResponseProcessor = (
  response: unknown,
  primary: unknown,
  secondary?: unknown,
  context?: Record<string, unknown>
) => unknown;
export type LMTaskGenerator = (
  processed: unknown,
  primary: unknown,
  secondary?: unknown,
  context?: Record<string, unknown>
) => unknown[];

export interface MockLMConfig {
  generateTextFn?: (prompt: string) => string | Promise<string>;
  generateObjectFn?: <T>(prompt: string, schema: unknown) => T | Promise<T>;
  available?: boolean;
  provider?: string;
  model?: string;
}
