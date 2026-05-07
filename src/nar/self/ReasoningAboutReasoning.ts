import type {NAR} from '../nar.js';
import {MetacognitiveMonitor} from './MetacognitiveMonitor.js';
import {SelfAnalyzer} from './SelfAnalyzer.js';

export interface ReasoningAboutReasoningConfig {
    maxTraceSize?: number;
    maxPerformanceHistory?: number;
    monitoringInterval?: number;
    reasoningInterval?: number;
    selfCorrectionEnabled?: boolean;
}

export class ReasoningAboutReasoning {
    private nar: NAR | null;
    private readonly config: Required<ReasoningAboutReasoningConfig>;
    private readonly monitor: MetacognitiveMonitor;
    private analyzer: SelfAnalyzer;
    private periodicAnalysisInterval: NodeJS.Timeout | null;

    constructor(nar: NAR | null, config: ReasoningAboutReasoningConfig = {}) {
        this.nar = nar;
        this.config = {
            maxTraceSize: config.maxTraceSize ?? 1000,
            maxPerformanceHistory: config.maxPerformanceHistory ?? 100,
            monitoringInterval: config.monitoringInterval ?? 1000,
            reasoningInterval: config.reasoningInterval ?? 30000,
            selfCorrectionEnabled: config.selfCorrectionEnabled ?? true
        };

        this.monitor = new MetacognitiveMonitor(nar, this.config);
        this.analyzer = new SelfAnalyzer(nar, this.monitor, this.config);
        this.periodicAnalysisInterval = null;

        this.startPeriodicSelfAnalysis();
    }

    async performMetaCognitiveReasoning(): Promise<any> {
        const result = await this.analyzer.performMetaCognitiveReasoning();
        result.monitorState = this.monitor.getMonitorState();
        return result;
    }

    async performSelfCorrection(): Promise<any> {
        return this.analyzer.performSelfCorrection();
    }

    querySystemState(_query: any): any {
        return {
            reasoningTrace: this.monitor.getReasoningTrace().slice(-10),
            performanceTrend: this.monitor.getPerformanceTrend(),
            currentContext: {},
            performanceMonitors: {},
            activeMetaTasks: 0
        };
    }

    getReasoningTrace(): any[] {
        return this.monitor.getReasoningTrace();
    }

    getReasoningState(): any {
        const monitorState = this.monitor.getMonitorState();
        return {
            active: (this.nar as any)?.isRunning ?? false,
            reasoningSteps: monitorState.reasoningSteps,
            performance: monitorState.performance,
            lastUpdate: Date.now(),
            monitorsActive: monitorState.monitorsActive,
            pendingMetaTasks: 0
        };
    }

    async getSystemAnalysis(): Promise<any> {
        return this.analyzer.getSystemAnalysis();
    }

    shutdown(): void {
        if (this.periodicAnalysisInterval) {
            clearInterval(this.periodicAnalysisInterval);
            this.periodicAnalysisInterval = null;
        }
        this.monitor.shutdown();
        this.analyzer.shutdown();
    }

    private startPeriodicSelfAnalysis(): void {
        if (this.config.reasoningInterval > 0) {
            this.periodicAnalysisInterval = setInterval(async () => {
                try {
                    await this.performMetaCognitiveReasoning();
                } catch {
                    // Silently handle periodic analysis errors
                }
            }, this.config.reasoningInterval);
        }
    }
}
