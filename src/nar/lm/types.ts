import type {Task} from '../types';
import type {ModelCapability, ModelRegistry} from './model-registry.js';

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
    priority?: number;
    enabled?: boolean;
    singlePremise?: boolean;
    lmOptions?: LMConfig;
    promptTemplate?: string | LMPromptGenerator;
    responseProcessor?: LMResponseProcessor;
    taskGenerator?: LMTaskGenerator;
}

export interface LMRuleConfigInternal extends LMRuleConfig {
    promptTemplate?: string | ((primary: any, secondary?: any, context?: any) => string);
    responseProcessor?: (response: any, primary: any, secondary?: any, context?: any) => any;
    taskGenerator?: (processed: any, primary: any, secondary?: any, context?: any) => Task[];
}

export interface LMClient {
    generateText(prompt: string, options?: LMConfig): Promise<string>;
}

export interface LMExecutionStats {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    totalDuration: number;
    totalTokens: number;
    averageDuration: number;
    successRate: number;
}

export interface LMRuleStats {
    id: string;
    name: string;
    enabled: boolean;
    stats: LMExecutionStats;
    circuitState: 'closed' | 'open' | 'half-open';
}

export type LMPromptGenerator = (primary: any, secondary?: any, context?: any) => string;
export type LMResponseProcessor = (response: any, primary: any, secondary?: any, context?: any) => any;
export type LMTaskGenerator = (processed: any, primary: any, secondary?: any, context?: any) => Task[];
