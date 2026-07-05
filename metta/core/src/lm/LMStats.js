export class LMStats {
    constructor() {
        this.totalCalls = 0;
        this.totalTokens = 0;
        this.avgResponseTime = 0;
        this.avgFirstTokenLatency = 0;
        this.avgTokensPerSecond = 0;
        this.peakMemoryUsage = 0;
        this.providerUsage = new Map();
    }

    #countTokens(text) {
        return typeof text === 'string' ? text.split(/\s+/).filter(t => t.length > 0).length : 0;
    }

    #updateAvg(current, newValue, count) {
        return (current * (count - 1) + newValue) / count;
    }

    update(prompt, result, providerId, startTime, firstTokenTime = null) {
        this.totalCalls++;
        const promptTokens = this.#countTokens(prompt);
        const resultTokens = this.#countTokens(result);
        this.totalTokens += promptTokens + resultTokens;

        const responseTime = Date.now() - startTime;
        this.avgResponseTime = this.#updateAvg(this.avgResponseTime, responseTime, this.totalCalls);

        if (firstTokenTime !== null) {
            this.avgFirstTokenLatency = this.#updateAvg(this.avgFirstTokenLatency, firstTokenTime - startTime, this.totalCalls);
        }

        if (responseTime > 0 && resultTokens > 0) {
            this.avgTokensPerSecond = this.#updateAvg(this.avgTokensPerSecond, (resultTokens / responseTime) * 1000, this.totalCalls);
        }

        const usage = this.providerUsage.get(providerId) ?? {
            calls: 0,
            tokens: 0,
            avgLatency: 0,
            successfulCalls: 0,
            reputation: 0.5
        };
        usage.calls++;
        usage.tokens += resultTokens;
        usage.avgLatency = this.#updateAvg(usage.avgLatency, responseTime, usage.calls);
        if (result?.length > 0) {
            usage.successfulCalls++;
        }
        usage.reputation = usage.successfulCalls / usage.calls;
        this.providerUsage.set(providerId, usage);

        if (typeof process !== 'undefined' && process.memoryUsage) {
            this.peakMemoryUsage = Math.max(this.peakMemoryUsage, process.memoryUsage().heapUsed);
        }
    }

    getMetrics(providerCount) {
        return {
            providerCount,
            lmStats: {
                totalCalls: this.totalCalls,
                totalTokens: this.totalTokens,
                avgResponseTime: this.avgResponseTime,
                avgFirstTokenLatency: this.avgFirstTokenLatency,
                avgTokensPerSecond: this.avgTokensPerSecond,
                peakMemoryUsageMB: Math.round(this.peakMemoryUsage / 1024 / 1024),
            },
            providerUsage: new Map(this.providerUsage)
        };
    }

    getCalibratedConfidence(providerId, logProb = null) {
        const usage = this.providerUsage.get(providerId);
        const reputation = usage?.reputation ?? 0.5;

        const confidence = logProb !== null
            ? Math.exp(logProb) * (0.5 + reputation * 0.5)
            : 0.6 + reputation * 0.3;

        return Math.max(0.1, Math.min(0.99, confidence));
    }
}
