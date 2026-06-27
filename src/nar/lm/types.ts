export interface LMRuleStats {
    id: string;
    name: string;
    enabled: boolean;
    stats: LMExecutionStats;
    circuitState: 'closed' | 'open' | 'half-open';
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

export type LMRuleConfig = {
    id?: string;
    name?: string;
    description?: string;
    category?: string;
    priority?: number;
    enabled?: boolean;
    singlePremise?: boolean;
    promptTemplate?: string | ((primary: any, secondary?: any, context?: Record<string, unknown>) => string);
    responseProcessor?: (response: unknown, primary: any, secondary?: any, context?: Record<string, unknown>) => unknown;
    taskGenerator?: (processed: unknown, primary: any, secondary?: any, context?: Record<string, unknown>) => unknown[];
    activationCondition?: (primary: any, secondary?: any, context?: Record<string, unknown>) => boolean;
    lmOptions?: {
        temperature?: number;
        maxTokens?: number;
        signal?: AbortSignal;
    };
};

export type LMPromptGenerator = (primary: any, secondary?: any, context?: Record<string, unknown>) => string;
export type LMResponseProcessor = (response: unknown, primary: any, secondary?: any, context?: Record<string, unknown>) => unknown;
export type LMTaskGenerator = (processed: unknown, primary: any, secondary?: any, context?: Record<string, unknown>) => unknown[];