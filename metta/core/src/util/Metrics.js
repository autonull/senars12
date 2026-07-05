export class Metrics {
    static create() {
        return {
            executions: 0,
            successes: 0,
            failures: 0,
            totalTime: 0,
            avgTime: 0,
            lastRun: null,
            lastError: null,
            createdAt: Date.now()
        };
    }

    static update(metrics, success, time, error = null) {
        const totalExecutions = metrics.executions + 1;
        return {
            executions: totalExecutions,
            successes: metrics.successes + (success ? 1 : 0),
            failures: metrics.failures + (success ? 0 : 1),
            totalTime: metrics.totalTime + time,
            avgTime: totalExecutions > 0 ? (metrics.totalTime + time) / totalExecutions : 0,
            lastRun: Date.now(),
            lastError: error,
            createdAt: metrics.createdAt
        };
    }

    static getStats(metrics) {
        const successRate = metrics.executions > 0 ? (metrics.successes / metrics.executions) * 100 : 0;
        return {
            executions: metrics.executions,
            successes: metrics.successes,
            failures: metrics.failures,
            successRate: Number(successRate.toFixed(2)),
            avgTime: Number(metrics.avgTime.toFixed(2)),
            totalTime: Number(metrics.totalTime.toFixed(2)),
            lastRun: metrics.lastRun,
            lastError: metrics.lastError,
            uptime: Date.now() - metrics.createdAt
        };
    }

    static merge(...metricSets) {
        const merged = this.create();
        for (const metrics of metricSets) {
            merged.executions += metrics.executions;
            merged.successes += metrics.successes;
            merged.failures += metrics.failures;
            merged.totalTime += metrics.totalTime;
            merged.lastRun = Math.max(merged.lastRun || 0, metrics.lastRun || 0);
            if (metrics.lastError) {
                merged.lastError = metrics.lastError;
            }
        }
        merged.avgTime = merged.executions > 0 ? merged.totalTime / merged.executions : 0;
        return merged;
    }

    static round(value, decimals = 2) {
        return Number(value.toFixed(decimals));
    }

    static format(stats) {
        const formatted = {...stats};
        Object.keys(formatted).forEach(key => {
            if (typeof formatted[key] === 'number' && !Number.isInteger(formatted[key])) {
                formatted[key] = this.round(formatted[key]);
            }
        });
        return formatted;
    }

    static reset() {
        return this.create();
    }
}