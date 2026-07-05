export class PerformanceTracker {
    constructor() {
        this.totalExecutions = 0;
        this.successfulExecutions = 0;
        this.failedExecutions = 0;
        this.averageExecutionTime = 0;
        this.toolUsageStats = new Map();
        this.errorPatterns = new Map();
    }

    #trackExecution(toolName, startTime, success, error) {
        const duration = Date.now() - startTime;
        this.totalExecutions++;
        if (success) {
            this.successfulExecutions++;
        } else {
            this.failedExecutions++;
        }
        this.averageExecutionTime = (this.averageExecutionTime * (this.successfulExecutions + this.failedExecutions - 1) + duration) / (this.successfulExecutions + this.failedExecutions);

        const stats = this.toolUsageStats.get(toolName) ?? {
            executions: 0,
            successes: 0,
            failures: 0,
            totalTime: 0,
            averageTime: 0
        };
        stats.executions++;
        if (success) {
            stats.successes++;
        } else {
            stats.failures++;
        }
        stats.totalTime += duration;
        stats.averageTime = stats.totalTime / stats.executions;
        this.toolUsageStats.set(toolName, stats);

        if (!success && error) {
            const key = error.constructor.name;
            this.errorPatterns.set(key, (this.errorPatterns.get(key) ?? 0) + 1);
        }
    }

    trackExecutionSuccess(toolName, startTime) {
        this.#trackExecution(toolName, startTime, true);
    }

    trackExecutionFailure(toolName, startTime, error) {
        this.#trackExecution(toolName, startTime, false, error);
    }

    getStats(tools) {
        const toolsByCategory = {};
        const toolUsage = new Map();
        for (const tool of tools.values()) {
            toolsByCategory[tool.category] = (toolsByCategory[tool.category] ?? 0) + 1;
            toolUsage.set(tool.id, tool.usageCount);
        }

        return {
            totalTools: tools.size,
            toolsByCategory,
            totalExecutions: this.totalExecutions,
            successfulExecutions: this.successfulExecutions,
            failedExecutions: this.failedExecutions,
            averageExecutionTime: this.averageExecutionTime,
            mostUsedTools: [...toolUsage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([toolName, count]) => ({
                toolName,
                count
            }))
        };
    }
}
