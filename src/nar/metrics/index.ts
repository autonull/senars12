export interface RuleStats {
    id: string;
    executions: number;
    successes: number;
    failures: number;
    averageDuration: number;
    lastExecution: number;
}

export interface MemoryStats {
    conceptCount: number;
    beliefCount: number;
    goalCount: number;
    questionCount: number;
    activationDistribution: {
        min: number;
        max: number;
        average: number;
    };
    forgettingRate: number;
}

export interface LMStats {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    tokenUsage: {
        input: number;
        output: number;
        total: number;
    };
    averageLatency: number;
    costEstimate: number;
}

export interface ThroughputStats {
    derivationsPerSecond: number;
    tasksProcessed: number;
    averageStepDuration: number;
}

export interface SystemMetrics {
    uptime: number;
    totalDerivations: number;
    totalSteps: number;
    errors: number;
    warnings: number;
}

export class MetricsCollector {
    private readonly startTime: number = Date.now();
    private ruleStats: Map<string, RuleStats> = new Map();
    private memoryStats: MemoryStats | null = null;
    private lmStats: LMStats | null = null;
    private throughputStats: ThroughputStats | null = null;
    private systemMetrics: SystemMetrics = {
        uptime: 0,
        totalDerivations: 0,
        totalSteps: 0,
        errors: 0,
        warnings: 0
    };

    recordRuleExecution(ruleId: string, success: boolean, duration: number): void {
        const existing = this.ruleStats.get(ruleId);

        if (existing) {
            existing.executions++;
            if (success) {
                existing.successes++;
            } else {
                existing.failures++;
            }
            existing.averageDuration = (existing.averageDuration * (existing.executions - 1) + duration) / existing.executions;
            existing.lastExecution = Date.now();
        } else {
            this.ruleStats.set(ruleId, {
                id: ruleId,
                executions: 1,
                successes: success ? 1 : 0,
                failures: success ? 0 : 1,
                averageDuration: duration,
                lastExecution: Date.now()
            });
        }
    }

    updateMemoryStats(stats: MemoryStats): void {
        this.memoryStats = stats;
    }

    updateLMStats(stats: Partial<LMStats>): void {
        if (!this.lmStats) {
            this.lmStats = {
                totalCalls: 0,
                successfulCalls: 0,
                failedCalls: 0,
                tokenUsage: {input: 0, output: 0, total: 0},
                averageLatency: 0,
                costEstimate: 0
            };
        }

        if (stats.totalCalls !== undefined) this.lmStats.totalCalls += stats.totalCalls;
        if (stats.successfulCalls !== undefined) this.lmStats.successfulCalls += stats.successfulCalls;
        if (stats.failedCalls !== undefined) this.lmStats.failedCalls += stats.failedCalls;
        if (stats.tokenUsage) {
            this.lmStats.tokenUsage.input += stats.tokenUsage.input;
            this.lmStats.tokenUsage.output += stats.tokenUsage.output;
            this.lmStats.tokenUsage.total += stats.tokenUsage.total;
        }
        if (stats.averageLatency !== undefined) this.lmStats.averageLatency = stats.averageLatency;
        if (stats.costEstimate !== undefined) this.lmStats.costEstimate = stats.costEstimate;
    }

    updateThroughput(derivations: number, duration: number): void {
        const now = Date.now();
        const elapsed = (now - this.startTime) / 1000;

        this.throughputStats = {
            derivationsPerSecond: elapsed > 0 ? derivations / elapsed : 0,
            tasksProcessed: derivations,
            averageStepDuration: duration
        };
    }

    incrementDerivations(count: number = 1): void {
        this.systemMetrics.totalDerivations += count;
    }

    incrementSteps(count: number = 1): void {
        this.systemMetrics.totalSteps += count;
    }

    recordError(): void {
        this.systemMetrics.errors++;
    }

    recordWarning(): void {
        this.systemMetrics.warnings++;
    }

    getRuleStats(ruleId?: string): RuleStats | RuleStats[] | null {
        if (ruleId) {
            return this.ruleStats.get(ruleId) || null;
        }
        return Array.from(this.ruleStats.values());
    }

    getMemoryStats(): MemoryStats | null {
        return this.memoryStats;
    }

    getLMStats(): LMStats | null {
        return this.lmStats;
    }

    getThroughputStats(): ThroughputStats | null {
        return this.throughputStats;
    }

    getSystemMetrics(): SystemMetrics {
        return {
            ...this.systemMetrics,
            uptime: Date.now() - this.startTime
        };
    }

    getSummary(): {
        rules: RuleStats[];
        memory: MemoryStats | null;
        lm: LMStats | null;
        throughput: ThroughputStats | null;
        system: SystemMetrics;
    } {
        return {
            rules: this.getRuleStats() as RuleStats[],
            memory: this.getMemoryStats(),
            lm: this.getLMStats(),
            throughput: this.getThroughputStats(),
            system: this.getSystemMetrics()
        };
    }

    reset(): void {
        this.ruleStats.clear();
        this.memoryStats = null;
        this.lmStats = null;
        this.throughputStats = null;
        this.systemMetrics = {
            uptime: 0,
            totalDerivations: 0,
            totalSteps: 0,
            errors: 0,
            warnings: 0
        };
        this.startTime;
    }
}

export const createMetricsCollector = (): MetricsCollector => {
    return new MetricsCollector();
};
