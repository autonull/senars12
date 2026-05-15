import type {MetricsCollector} from '../metrics';
import type {NAR} from '../nar.js';

export interface PerformanceAnalysis {
    ruleExecution: number;
    memoryUsage: number;
    throughput: 'increasing' | 'decreasing' | 'stable';
}

export class PerformanceAnalyzer {
    private readonly metrics: MetricsCollector | null;
    private patternHistory = new Map<string, number[]>();
    private readonly MAX_PATTERN_HISTORY_SIZE = 100;

    constructor(metrics: MetricsCollector | null) {
        this.metrics = metrics;
    }

    analyzePerformancePatterns(): PerformanceAnalysis {
        return {
            ruleExecution: this.calculateAverageRuleExecutionTime(),
            memoryUsage: this.calculateAverageMemoryUsage(),
            throughput: this.determineThroughputTrend()
        };
    }

    analyzeTaskPatterns(nar: NAR | null): { avgProcessingTime: number; queueDepth: number; dropRate: number } {
        if (!nar || !this.metrics) {
            return {avgProcessingTime: 0, queueDepth: 0, dropRate: 0};
        }

        const metricsSummary = this.metrics.getSummary();
        const stats = nar.getStatistics();
        const avgProcessingTime = metricsSummary.throughput?.averageStepDuration ?? 0;
        const totalTasks = stats?.totalTasks ?? 0;

        return {
            avgProcessingTime,
            queueDepth: 0,
            dropRate: totalTasks > 0 ? 0 / totalTasks : 0
        };
    }

    calculateAverageRuleExecutionTime(): number {
        if (!this.metrics) return 0;
        const ruleStats = this.metrics.getRuleStats();
        if (!ruleStats || !Array.isArray(ruleStats) || ruleStats.length === 0) return 0;
        return ruleStats.reduce((sum, s) => sum + s.averageDuration, 0) / ruleStats.length;
    }

    calculateAverageMemoryUsage(): number {
        try {
            const usage = process.memoryUsage();
            return (usage.heapUsed + usage.heapTotal) / 2;
        } catch (e) { console.error('Memory check failed:', e); return 0; }
    }

    determineThroughputTrend(): 'increasing' | 'decreasing' | 'stable' {
        if (this.patternHistory.size < 2) return 'stable';

        const recent = Array.from(this.patternHistory.values()).slice(-5).flat();
        if (recent.length < 2) return 'stable';

        const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const last = recent[recent.length - 1] ?? avg;
        return last > avg * 1.1 ? 'increasing' : last < avg * 0.9 ? 'decreasing' : 'stable';
    }

    trackPattern(key: string, value: number): void {
        if (!this.patternHistory.has(key)) {
            this.patternHistory.set(key, []);
        }
        const history = this.patternHistory.get(key)!;
        history.push(value);
        if (history.length > this.MAX_PATTERN_HISTORY_SIZE) {
            history.shift();
        }
    }

    identifySuccessfulStrategies(): string[] {
        if (!this.metrics) return [];

        const ruleStats = this.metrics.getRuleStats();
        if (!ruleStats || !Array.isArray(ruleStats)) return [];

        const successful = ruleStats.filter(s => s.successes > 0 && s.executions > 0);
        successful.sort((a, b) => (b.successes / b.executions) - (a.successes / a.executions));
        return successful.slice(0, 5).map(s => s.id);
    }
}