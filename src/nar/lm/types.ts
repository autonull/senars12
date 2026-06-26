import type {Task} from '../types';
import type {ModelCapability} from './model-registry.js';
import type {Term} from '../terms';

export interface LMConfig {
    temperature?: number;
    maxTokens?: number;
    model?: string;
    apiKey?: string;
    provider?: string;
}

export interface ModelConfig {
    id: string;
    provider: 'anthropic' | 'openai' | 'ollama' | 'mock';
    model: string;
    capabilities: Omit<ModelCapability, 'provider' | 'model'>;
    config?: LMConfig;
}

export interface LMRuleConfig {
    id?: string;
    name?: string;
    description?: string;
    category?: string;
    priority?: number;
    enabled?: boolean;
    singlePremise?: boolean;
    lmOptions?: LMConfig;
    promptTemplate?: string | LMPromptGenerator;
    responseProcessor?: LMResponseProcessor;
    taskGenerator?: LMTaskGenerator;
    activationCondition?: (primary: Term, secondary?: Term, context?: Record<string, unknown>) => boolean;
}

export interface LMRuleConfigInternal extends LMRuleConfig {
    promptTemplate?: string | ((primary: Term, secondary?: Term, context?: Record<string, unknown>) => string);
    responseProcessor?: (response: unknown, primary: Term, secondary?: Term, context?: Record<string, unknown>) => unknown;
    taskGenerator?: (processed: unknown, primary: Term, secondary?: Term, context?: Record<string, unknown>) => Task[];
}

export interface LMClientStats {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    timeoutCount: number;
    totalDuration: number;
    averageDuration: number;
    queueDepth: number;
    queueHighWater: number;
}

export interface LMClient {
    provider?: string;
    model?: string;
    available?: boolean;

    generateText(prompt: string, options?: LMConfig & { signal?: AbortSignal }): Promise<string>;

    setModel?(model: string): void;

    getStats?(): LMClientStats;
}

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

export interface LMRuleStats {
    id: string;
    name: string;
    enabled: boolean;
    stats: LMExecutionStats;
    circuitState: 'closed' | 'open' | 'half-open';
}

export type LMPromptGenerator = (primary: Term, secondary?: Term, context?: Record<string, unknown>) => string;
export type LMResponseProcessor = (response: unknown, primary: Term, secondary?: Term, context?: Record<string, unknown>) => unknown;
export type LMTaskGenerator = (processed: unknown, primary: Term, secondary?: Term, context?: Record<string, unknown>) => Task[];
