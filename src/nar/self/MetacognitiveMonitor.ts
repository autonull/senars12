interface PerformanceData {
    throughput?: number;
    avgProcessingTime?: number;
    memoryUsage?: number;
    cpuThrottleCount?: number;
    timestamp: number;
}

interface PerformanceMonitor {
    currentValue: number;
    trend: number;
    stability: number;
    history: Array<{ value: number; timestamp: number }>;
    alerts: any[];
}

export interface ReasoningStep {
    timestamp: number;
    stepData: {
        type?: string;
        task?: unknown;
        ruleId?: string;
        result?: unknown;
        duration?: number;
        startTerm?: string;
        endTerm?: string;
        success?: boolean;
        error?: unknown;
        [key: string]: unknown;
    };
    context: {
        memorySize?: number;
        timestamp?: number;
        [key: string]: unknown;
    };
}

interface PerformanceIssue {
    type: string;
    severity: string;
    value: number;
    threshold: number;
}

export interface MetacognitiveMonitorConfig {
    maxTraceSize?: number;
    maxPerformanceHistory?: number;
    minThroughput?: number;
    maxAvgProcessingTime?: number;
    maxMemoryUsage?: number;
}

export class MetacognitiveMonitor {
    private nar: any;
    private config: Required<MetacognitiveMonitorConfig>;
    private reasoningTrace: ReasoningStep[];
    private performanceHistory: PerformanceData[];
    private performanceMonitors: Map<string, PerformanceMonitor>;

    constructor(nar: any, config: MetacognitiveMonitorConfig = {}) {
        this.nar = nar;
        this.config = {
            maxTraceSize: config.maxTraceSize ?? 1000,
            maxPerformanceHistory: config.maxPerformanceHistory ?? 100,
            minThroughput: config.minThroughput ?? 0.1,
            maxAvgProcessingTime: config.maxAvgProcessingTime ?? 1000,
            maxMemoryUsage: config.maxMemoryUsage ?? 100000000
        };
        this.reasoningTrace = [];
        this.performanceHistory = [];
        this.performanceMonitors = new Map();
        this.setupMonitoring();
    }

    recordReasoningStep(stepData: any): void {
        this.reasoningTrace.push({
            timestamp: Date.now(),
            stepData,
            context: this.getCurrentContext()
        });

        if (this.reasoningTrace.length > this.config.maxTraceSize) {
            this.reasoningTrace = this.reasoningTrace.slice(-Math.floor(this.config.maxTraceSize / 2));
        }
    }

    recordError(errorData: any): void {
        this.reasoningTrace.push({
            timestamp: Date.now(),
            stepData: {type: 'error', errorData},
            context: this.getCurrentContext()
        });
    }

    analyzePerformance(metrics: Partial<PerformanceData>): PerformanceIssue[] {
        const performanceRecord: PerformanceData = {
            ...metrics,
            timestamp: Date.now()
        };

        this.performanceHistory.push(performanceRecord);
        if (this.performanceHistory.length > this.config.maxPerformanceHistory) {
            this.performanceHistory = this.performanceHistory.slice(-Math.floor(this.config.maxPerformanceHistory / 2));
        }

        const issues = this.detectPerformanceIssues(performanceRecord);
        this.updatePerformanceMonitors(performanceRecord);

        return issues;
    }

    detectPerformanceIssues(currentMetrics: Partial<PerformanceData>): PerformanceIssue[] {
        const issues: PerformanceIssue[] = [];

        if (currentMetrics.throughput != null && currentMetrics.throughput < this.config.minThroughput) {
            issues.push({
                type: 'low_throughput',
                severity: 'medium',
                value: currentMetrics.throughput,
                threshold: this.config.minThroughput
            });
        }

        if (currentMetrics.avgProcessingTime != null && currentMetrics.avgProcessingTime > this.config.maxAvgProcessingTime) {
            issues.push({
                type: 'high_processing_time',
                severity: 'high',
                value: currentMetrics.avgProcessingTime,
                threshold: this.config.maxAvgProcessingTime
            });
        }

        if (currentMetrics.memoryUsage != null && currentMetrics.memoryUsage > this.config.maxMemoryUsage) {
            issues.push({
                type: 'memory_pressure',
                severity: 'high',
                value: currentMetrics.memoryUsage,
                threshold: this.config.maxMemoryUsage
            });
        }

        return issues;
    }

    getPerformanceTrend(): string {
        if (this.performanceHistory.length < 2) {
            return 'insufficient_data';
        }

        const recent = this.performanceHistory.slice(-10);
        const avgThroughput = recent.reduce((sum, m) => sum + (m.throughput || 0), 0) / recent.length;

        const earlier = this.performanceHistory.slice(Math.max(0, this.performanceHistory.length - 20), -10);
        if (earlier.length === 0) {
            return avgThroughput > 0 ? 'improving' : 'declining';
        }

        const avgEarlierThroughput = earlier.reduce((sum, m) => sum + (m.throughput || 0), 0) / earlier.length;
        return avgThroughput > avgEarlierThroughput ? 'improving' : avgThroughput < avgEarlierThroughput ? 'declining' : 'stable';
    }

    getMonitorState(): { reasoningSteps: number; performance: string; lastUpdate: number; monitorsActive: number; reasoningTrace: ReasoningStep[] } {
        return {
            reasoningSteps: this.reasoningTrace.length,
            performance: this.getPerformanceTrend(),
            lastUpdate: Date.now(),
            monitorsActive: this.performanceMonitors.size,
            reasoningTrace: this.reasoningTrace
        };
    }

    getReasoningTrace(): ReasoningStep[] {
        return [...this.reasoningTrace];
    }

    shutdown(): void {
        this.reasoningTrace = [];
        this.performanceHistory = [];
        this.performanceMonitors.clear();
    }

    private setupMonitoring(): void {
        if (!this.nar?.eventBus) return;

        const eventBus = this.nar.eventBus;

        eventBus.on('task:processed', (task: any) => {
            this.recordReasoningStep({
                type: 'task_processed',
                task: task,
                timestamp: Date.now()
            });
        });

        eventBus.on('task:derived', (task: any) => {
            this.recordReasoningStep({
                type: 'task_derived',
                task: task,
                timestamp: Date.now()
            });
        });

        eventBus.on('rule:fired', (data: any) => {
            this.recordReasoningStep({
                type: 'rule_fired',
                ruleId: data.ruleId,
                result: data.result,
                timestamp: Date.now()
            });
        });

        eventBus.on('error', (error: any) => {
            this.recordError({
                type: 'error',
                error: error,
                timestamp: Date.now()
            });
        });

        const _startTime = Date.now();
        let lastThroughput = 0;
        let lastThroughputTime = Date.now();
        let processedCount = 0;

        eventBus.on('task:processed', () => {
            processedCount++;
            const now = Date.now();
            if (now - lastThroughputTime > 1000) {
                lastThroughput = processedCount / ((now - lastThroughputTime) / 1000);
                processedCount = 0;
                lastThroughputTime = now;
            }
        });

        setInterval(() => {
            const memoryUsage = process.memoryUsage ? process.memoryUsage().heapUsed : 0;
            this.analyzePerformance({
                throughput: lastThroughput,
                memoryUsage,
                timestamp: Date.now()
            });
        }, 5000);
    }

    private updatePerformanceMonitors(metrics: Partial<PerformanceData>): void {
        const metricNames = ['throughput', 'avgProcessingTime', 'memoryUsage', 'cpuThrottleCount'] as const;

        for (const metricName of metricNames) {
            const value = metrics[metricName];
            if (value !== undefined) {
                let currentMonitor = this.performanceMonitors.get(metricName) || {
                    currentValue: 0,
                    trend: 0,
                    stability: 0,
                    history: [],
                    alerts: []
                };

                currentMonitor.history.push({value, timestamp: Date.now()});
                if (currentMonitor.history.length > 50) {
                    currentMonitor.history = currentMonitor.history.slice(-25);
                }

                if (currentMonitor.history.length >= 2) {
                    const recent = currentMonitor.history[currentMonitor.history.length - 1]!.value;
                    const previous = currentMonitor.history[currentMonitor.history.length - 2]!.value;
                    currentMonitor.trend = recent - previous;
                }

                if (currentMonitor.history.length > 1) {
                    const values = currentMonitor.history.map(h => h.value);
                    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
                    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
                    currentMonitor.stability = 1 / (1 + Math.sqrt(variance));
                }

                currentMonitor.currentValue = value;
                this.performanceMonitors.set(metricName, currentMonitor);
            }
        }
    }

    private getCurrentContext(): any {
        return {
            memorySize: (this.nar as any)?.memory?.size ?? 0,
            timestamp: Date.now()
        };
    }
}
