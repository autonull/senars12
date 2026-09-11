import type {LMExecutionStats} from './lm-service.js';

export function createLMStats(): LMExecutionStats {
    return {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        totalDuration: 0,
        totalTokens: 0,
        averageDuration: 0,
        successRate: 0,
        totalCost: 0,
        averageCost: 0,
    };
}

export function recordLMCall(
    stats: LMExecutionStats,
    success: boolean,
    durationMs: number,
    tokens: number
): void {
    stats.totalCalls++;
    if (success) stats.successfulCalls++;
    else stats.failedCalls++;
    stats.totalDuration += durationMs;
    stats.totalTokens += tokens;
    stats.averageDuration = stats.totalDuration / stats.totalCalls;
    stats.successRate = stats.successfulCalls / stats.totalCalls;
}
