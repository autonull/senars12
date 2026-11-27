/**
 * Loop Appraisal — meta-evaluation of loop performance and health.
 *
 * Provides continuous assessment of loop quality, efficiency, and alignment.
 */
/** Appraisal dimensions. */
export const APPRAISAL_DIMENSIONS = [
    'efficiency',
    'effectiveness',
    'coherence',
    'adaptability',
    'safety',
    'progress',
];
/** Default appraisal configuration. */
export const defaultAppraisalConfig = {
    weights: {
        efficiency: 0.2,
        effectiveness: 0.25,
        coherence: 0.2,
        adaptability: 0.15,
        safety: 0.1,
        progress: 0.1,
    },
    minEvidence: 3,
    historyWindow: 50,
    detailed: true,
};
/** Loop appraiser. */
export class LoopAppraiser {
    config;
    history = [];
    metricsHistory = [];
    iteration = 0;
    clock;
    constructor(config = {}, options = {}) {
        this.config = { ...defaultAppraisalConfig, ...config };
        this.clock = options.clock ?? { now: () => Date.now(), setTime: () => { }, advance: () => { } };
    }
    /** Record metrics for an iteration. */
    recordMetrics(metrics) {
        this.metricsHistory.push(metrics);
        if (this.metricsHistory.length > this.config.historyWindow) {
            this.metricsHistory.shift();
        }
    }
    /** Record contract results. */
    recordContractResults(results) {
        // Metrics will be computed from these
    }
    /** Perform appraisal. */
    appraise(iteration, metrics) {
        this.iteration = iteration;
        this.recordMetrics(metrics);
        const dimensions = this.appraiseDimensions(metrics);
        const overallScore = this.computeOverallScore(dimensions);
        const summary = this.generateSummary(dimensions, overallScore);
        const recommendations = this.generateRecommendations(dimensions);
        const appraisal = {
            overallScore,
            dimensions,
            timestamp: this.clock.now(),
            iteration,
            summary,
            recommendations,
        };
        this.history.push(appraisal);
        if (this.history.length > this.config.historyWindow) {
            this.history.shift();
        }
        return appraisal;
    }
    /** Appraise all dimensions. */
    appraiseDimensions(metrics) {
        return [
            this.appraiseEfficiency(metrics),
            this.appraiseEffectiveness(metrics),
            this.appraiseCoherence(metrics),
            this.appraiseAdaptability(metrics),
            this.appraiseSafety(metrics),
            this.appraiseProgress(metrics),
        ];
    }
    /** Appraise efficiency. */
    appraiseEfficiency(metrics) {
        const evidence = [
            {
                source: 'metric',
                description: 'Tokens per iteration',
                value: this.normalizeTokens(metrics.tokensPerIteration),
                weight: 0.4,
            },
            {
                source: 'metric',
                description: 'Time per iteration',
                value: this.normalizeTime(metrics.timePerIteration),
                weight: 0.3,
            },
            {
                source: 'metric',
                description: 'Oracle calls per iteration',
                value: this.normalizeOracleCalls(metrics.oracleCallsPerIteration),
                weight: 0.3,
            },
        ];
        const score = this.weightedAverage(evidence);
        const trend = this.computeTrend('efficiency', score);
        return {
            dimension: 'efficiency',
            score,
            confidence: 0.8,
            evidence,
            trend,
        };
    }
    /** Appraise effectiveness. */
    appraiseEffectiveness(metrics) {
        const evidence = [
            {
                source: 'metric',
                description: 'Oracle success rate',
                value: metrics.oracleSuccessRate,
                weight: 0.3,
            },
            {
                source: 'metric',
                description: 'Goal achievement rate',
                value: metrics.goalAchievementRate,
                weight: 0.4,
            },
            {
                source: 'metric',
                description: 'Contract violation rate (inverted)',
                value: 1 - metrics.contractViolationRate,
                weight: 0.3,
            },
        ];
        const score = this.weightedAverage(evidence);
        const trend = this.computeTrend('effectiveness', score);
        return {
            dimension: 'effectiveness',
            score,
            confidence: 0.85,
            evidence,
            trend,
        };
    }
    /** Appraise coherence. */
    appraiseCoherence(metrics) {
        const evidence = [
            {
                source: 'metric',
                description: 'Contradiction rate (inverted)',
                value: 1 - metrics.contradictionRate,
                weight: 0.5,
            },
            {
                source: 'metric',
                description: 'Unique tasks ratio',
                value: metrics.uniqueTasksRatio,
                weight: 0.3,
            },
            {
                source: 'heuristic',
                description: 'Belief consistency',
                value: this.estimateBeliefConsistency(metrics),
                weight: 0.2,
            },
        ];
        const score = this.weightedAverage(evidence);
        const trend = this.computeTrend('coherence', score);
        return {
            dimension: 'coherence',
            score,
            confidence: 0.75,
            evidence,
            trend,
        };
    }
    /** Appraise adaptability. */
    appraiseAdaptability(metrics) {
        const evidence = [
            {
                source: 'metric',
                description: 'Fallback usage rate (inverted - lower is more adaptive)',
                value: 1 - metrics.fallbackUsageRate,
                weight: 0.4,
            },
            {
                source: 'metric',
                description: 'Belief growth rate',
                value: this.normalizeGrowth(metrics.beliefGrowthRate),
                weight: 0.4,
            },
            {
                source: 'heuristic',
                description: 'Strategy diversity',
                value: this.estimateStrategyDiversity(metrics),
                weight: 0.2,
            },
        ];
        const score = this.weightedAverage(evidence);
        const trend = this.computeTrend('adaptability', score);
        return {
            dimension: 'adaptability',
            score,
            confidence: 0.7,
            evidence,
            trend,
        };
    }
    /** Appraise safety. */
    appraiseSafety(metrics) {
        const evidence = [
            {
                source: 'metric',
                description: 'Contract violation rate (inverted)',
                value: 1 - metrics.contractViolationRate,
                weight: 0.5,
            },
            {
                source: 'metric',
                description: 'Contradiction rate (inverted)',
                value: 1 - metrics.contradictionRate,
                weight: 0.3,
            },
            {
                source: 'heuristic',
                description: 'Action safety',
                value: this.estimateActionSafety(metrics),
                weight: 0.2,
            },
        ];
        const score = this.weightedAverage(evidence);
        const trend = this.computeTrend('safety', score);
        return {
            dimension: 'safety',
            score,
            confidence: 0.9,
            evidence,
            trend,
        };
    }
    /** Appraise progress. */
    appraiseProgress(metrics) {
        const evidence = [
            {
                source: 'metric',
                description: 'Goal achievement rate',
                value: metrics.goalAchievementRate,
                weight: 0.5,
            },
            {
                source: 'metric',
                description: 'Belief growth rate',
                value: this.normalizeGrowth(metrics.beliefGrowthRate),
                weight: 0.3,
            },
            {
                source: 'metric',
                description: 'Unique tasks ratio',
                value: metrics.uniqueTasksRatio,
                weight: 0.2,
            },
        ];
        const score = this.weightedAverage(evidence);
        const trend = this.computeTrend('progress', score);
        return {
            dimension: 'progress',
            score,
            confidence: 0.8,
            evidence,
            trend,
        };
    }
    /** Compute weighted average of evidence. */
    weightedAverage(evidence) {
        let sum = 0;
        let weightSum = 0;
        for (const e of evidence) {
            sum += e.value * e.weight;
            weightSum += e.weight;
        }
        return weightSum > 0 ? sum / weightSum : 0.5;
    }
    /** Compute overall score. */
    computeOverallScore(dimensions) {
        let sum = 0;
        let weightSum = 0;
        for (const dim of dimensions) {
            const weight = this.config.weights[dim.dimension] ?? 0;
            sum += dim.score * weight;
            weightSum += weight;
        }
        return weightSum > 0 ? sum / weightSum : 0.5;
    }
    /** Compute trend for a dimension. */
    computeTrend(dimension, currentScore) {
        if (this.history.length < 5)
            return 'stable';
        const recentScores = this.history
            .slice(-5)
            .map(h => h.dimensions.find(d => d.dimension === dimension)?.score ?? 0.5);
        const avgRecent = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
        const diff = currentScore - avgRecent;
        if (diff > 0.05)
            return 'improving';
        if (diff < -0.05)
            return 'declining';
        return 'stable';
    }
    /** Generate summary. */
    generateSummary(dimensions, overallScore) {
        const worst = dimensions.reduce((a, b) => a.score < b.score ? a : b);
        const best = dimensions.reduce((a, b) => a.score > b.score ? a : b);
        return `Overall: ${(overallScore * 100).toFixed(1)}% | ` +
            `Strongest: ${best.dimension} (${(best.score * 100).toFixed(1)}%) | ` +
            `Weakest: ${worst.dimension} (${(worst.score * 100).toFixed(1)}%)`;
    }
    /** Generate recommendations. */
    generateRecommendations(dimensions) {
        const recommendations = [];
        for (const dim of dimensions) {
            if (dim.score < 0.4) {
                recommendations.push(`Critical: Improve ${dim.dimension} (${(dim.score * 100).toFixed(1)}%)`);
            }
            else if (dim.score < 0.6) {
                recommendations.push(`Warning: ${dim.dimension} needs attention (${(dim.score * 100).toFixed(1)}%)`);
            }
            if (dim.trend === 'declining') {
                recommendations.push(`Trend: ${dim.dimension} declining`);
            }
        }
        return recommendations.slice(0, 5);
    }
    /** Normalize tokens per iteration (lower is better). */
    normalizeTokens(tokens) {
        // Assume 1000 tokens is baseline, 10000 is poor
        return Math.max(0, 1 - (tokens - 1000) / 9000);
    }
    /** Normalize time per iteration (lower is better). */
    normalizeTime(ms) {
        // Assume 100ms baseline, 5000ms poor
        return Math.max(0, 1 - (ms - 100) / 4900);
    }
    /** Normalize oracle calls (lower is better). */
    normalizeOracleCalls(calls) {
        // Assume 1 call baseline, 20 calls poor
        return Math.max(0, 1 - (calls - 1) / 19);
    }
    /** Normalize growth rate. */
    normalizeGrowth(rate) {
        // Rate of 0.1 per iteration is good
        return Math.min(1, rate * 10);
    }
    /** Estimate belief consistency. */
    estimateBeliefConsistency(metrics) {
        // Heuristic: low contradiction rate = high consistency
        return 1 - metrics.contradictionRate;
    }
    /** Estimate strategy diversity. */
    estimateStrategyDiversity(metrics) {
        // Heuristic: unique tasks ratio indicates diversity
        return metrics.uniqueTasksRatio;
    }
    /** Estimate action safety. */
    estimateActionSafety(metrics) {
        // Heuristic: low contract violations + low contradictions = safe
        return (1 - metrics.contractViolationRate + 1 - metrics.contradictionRate) / 2;
    }
    /** Get appraisal history. */
    getHistory(limit = 10) {
        return this.history.slice(-limit);
    }
    /** Get latest appraisal. */
    getLatest() {
        return this.history[this.history.length - 1] ?? null;
    }
    /** Get dimension trends. */
    getTrends() {
        const trends = {
            efficiency: { scores: [], current: 0 },
            effectiveness: { scores: [], current: 0 },
            coherence: { scores: [], current: 0 },
            adaptability: { scores: [], current: 0 },
            safety: { scores: [], current: 0 },
            progress: { scores: [], current: 0 },
        };
        for (const appraisal of this.history) {
            for (const dim of appraisal.dimensions) {
                trends[dim.dimension].scores.push(dim.score);
                trends[dim.dimension].current = dim.score;
            }
        }
        return trends;
    }
    /** Get statistics. */
    getStats() {
        const dimensionAverages = {
            efficiency: 0,
            effectiveness: 0,
            coherence: 0,
            adaptability: 0,
            safety: 0,
            progress: 0,
        };
        if (this.history.length === 0) {
            return {
                totalAppraisals: 0,
                avgOverallScore: 0,
                currentOverallScore: 0,
                dimensionAverages,
            };
        }
        const avgOverall = this.history.reduce((sum, a) => sum + a.overallScore, 0) / this.history.length;
        const current = this.history[this.history.length - 1]?.overallScore ?? 0;
        for (const dim of APPRAISAL_DIMENSIONS) {
            const scores = this.history.map(h => h.dimensions.find(d => d.dimension === dim)?.score ?? 0);
            dimensionAverages[dim] = scores.reduce((a, b) => a + b, 0) / scores.length;
        }
        return {
            totalAppraisals: this.history.length,
            avgOverallScore: avgOverall,
            currentOverallScore: current,
            dimensionAverages,
        };
    }
}
/** Create a loop appraiser. */
export function createLoopAppraiser(config, options) {
    return new LoopAppraiser(config, options);
}
/** Global loop appraiser instance (non-deterministic; prefer {@link createLoopAppraiser}). */
export const loopAppraiser = createLoopAppraiser();
/** Metrics collector for appraisal. */
export class AppraisalMetricsCollector {
    iteration = 0;
    tokensUsed = 0;
    oracleCalls = 0;
    oracleSuccesses = 0;
    contractViolations = 0;
    contractChecks = 0;
    beliefsStart = 0;
    goalsAchieved = 0;
    goalsTotal = 0;
    contradictions = 0;
    uniqueTasks = new Set();
    totalTasks = 0;
    fallbacksUsed = 0;
    totalFacultyCalls = 0;
    /** Start a new iteration. */
    startIteration(beliefsCount) {
        this.iteration++;
        this.beliefsStart = beliefsCount;
        this.uniqueTasks.clear();
    }
    /** Record token usage. */
    recordTokens(tokens) {
        this.tokensUsed += tokens;
    }
    /** Record oracle call. */
    recordOracleCall(success) {
        this.oracleCalls++;
        if (success)
            this.oracleSuccesses++;
    }
    /** Record contract check. */
    recordContractCheck(passed) {
        this.contractChecks++;
        if (!passed)
            this.contractViolations++;
    }
    /** Record goal achievement. */
    recordGoalAchieved() {
        this.goalsAchieved++;
        this.goalsTotal++;
    }
    /** Record goal failed. */
    recordGoalFailed() {
        this.goalsTotal++;
    }
    /** Record contradiction. */
    recordContradiction() {
        this.contradictions++;
    }
    /** Record task processed. */
    recordTask(task) {
        this.totalTasks++;
        this.uniqueTasks.add(task);
    }
    /** Record fallback used. */
    recordFallback() {
        this.fallbacksUsed++;
        this.totalFacultyCalls++;
    }
    /** Record faculty call. */
    recordFacultyCall() {
        this.totalFacultyCalls++;
    }
    /** Build metrics snapshot. */
    buildMetrics() {
        return {
            tokensPerIteration: this.iteration > 0 ? this.tokensUsed / this.iteration : 0,
            timePerIteration: 0, // Would be tracked separately
            oracleCallsPerIteration: this.iteration > 0 ? this.oracleCalls / this.iteration : 0,
            oracleSuccessRate: this.oracleCalls > 0 ? this.oracleSuccesses / this.oracleCalls : 1,
            contractViolationRate: this.contractChecks > 0 ? this.contractViolations / this.contractChecks : 0,
            beliefGrowthRate: this.iteration > 1 ? (this.beliefsStart - this.beliefsStart) / this.iteration : 0, // Placeholder
            goalAchievementRate: this.goalsTotal > 0 ? this.goalsAchieved / this.goalsTotal : 0,
            contradictionRate: this.totalTasks > 0 ? this.contradictions / this.totalTasks : 0,
            uniqueTasksRatio: this.totalTasks > 0 ? this.uniqueTasks.size / this.totalTasks : 0,
            fallbackUsageRate: this.totalFacultyCalls > 0 ? this.fallbacksUsed / this.totalFacultyCalls : 0,
        };
    }
    /** Reset for new appraisal window. */
    reset() {
        this.iteration = 0;
        this.tokensUsed = 0;
        this.oracleCalls = 0;
        this.oracleSuccesses = 0;
        this.contractViolations = 0;
        this.contractChecks = 0;
        this.beliefsStart = 0;
        this.goalsAchieved = 0;
        this.goalsTotal = 0;
        this.contradictions = 0;
        this.uniqueTasks.clear();
        this.totalTasks = 0;
        this.fallbacksUsed = 0;
        this.totalFacultyCalls = 0;
    }
}
