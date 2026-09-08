import {MetacognitiveMonitor} from '../cognitive/MetacognitiveMonitor.js';
import {
    type MetaCognitiveResult,
    type MonitorState,
    SelfAnalyzerService as SelfAnalyzer,
} from '../cognitive/SelfAnalyzerService.js';
import {createLogger} from '../logger';
import type {NAR} from '../nar.js';

export interface GapReport {
    missingRules: string[];
    lowConfidenceBeliefs: Array<{ term: string; f: number; c: number }>;
    repeatedFailures: string[];
}

const logger = createLogger({scope: 'ReasoningAboutReasoning'});

export interface ReasoningAboutReasoningConfig {
    maxTraceSize?: number;
    maxPerformanceHistory?: number;
    monitoringInterval?: number;
    reasoningInterval?: number;
    selfCorrectionEnabled?: boolean;
}

export interface SystemState {
    reasoningTrace: unknown[];
    performanceTrend: string;
    currentContext: { memorySize: number; conceptCount: number; timestamp: number };
    performanceMonitors: { throughput: number; memoryUsage?: NodeJS.MemoryUsage };
    activeMetaTasks: number;
    isRunning: boolean;
    config?: unknown;
    stats?: unknown;
}

export interface ReasoningState {
    active: boolean;
    reasoningSteps: number;
    performance: string;
    lastUpdate: number;
    monitorsActive: number;
    pendingMetaTasks: number;
}

export interface QualityAssessment {
    overall: number;
    coherence: number;
    relevance: number;
    completeness: number;
    timestamp: number;
}

export class ReasoningAboutReasoning {
    isRunning = false;
    private readonly nar: NAR | null;
    private readonly config: Required<ReasoningAboutReasoningConfig>;
    private readonly monitor: MetacognitiveMonitor;
    private analyzer: SelfAnalyzer;
    private periodicAnalysisInterval: NodeJS.Timeout | null = null;

    constructor(nar: NAR | null, config: ReasoningAboutReasoningConfig = {}) {
        this.nar = nar;
        this.config = {
            maxTraceSize: config.maxTraceSize ?? 1000,
            maxPerformanceHistory: config.maxPerformanceHistory ?? 100,
            monitoringInterval: config.monitoringInterval ?? 1000,
            reasoningInterval: config.reasoningInterval ?? 30000,
            selfCorrectionEnabled: config.selfCorrectionEnabled ?? true,
        };

        this.monitor = new MetacognitiveMonitor(nar, this.config);
        this.analyzer = new SelfAnalyzer(nar, this.monitor, null, this.config);
    }

    start(): void {
        this.isRunning = true;
        this.startPeriodicSelfAnalysis();
    }

    stop(): void {
        this.isRunning = false;
        if (this.periodicAnalysisInterval) {
            clearInterval(this.periodicAnalysisInterval);
            this.periodicAnalysisInterval = null;
        }
    }

    applyOptimizations(): void {
        this.analyzer.applyOptimizations?.();
    }

    async performMetaCognitiveReasoning(): Promise<MetaCognitiveResult> {
        const result = await this.analyzer.performMetaCognitiveReasoning();
        result.monitorState = this.monitor.getMonitorState();
        return result;
    }

    async performSelfCorrection(): Promise<MetaCognitiveResult> {
        return this.analyzer.performSelfCorrection();
    }

    async analyzeReasoningGaps(): Promise<GapReport> {
        return {missingRules: [], lowConfidenceBeliefs: [], repeatedFailures: []};
    }

    querySystemState(): SystemState {
        if (!this.nar) {
            return {
                reasoningTrace: [],
                performanceTrend: 'unknown',
                currentContext: {memorySize: 0, conceptCount: 0, timestamp: Date.now()},
                performanceMonitors: {throughput: 0},
                activeMetaTasks: 0,
                isRunning: false,
            };
        }

        const memory = this.nar.memory;
        const config = this.nar.getConfig?.();
        const stats = this.nar.getStatistics?.();
        const monitorState = this.monitor.getMonitorState();
        const isRunning =
            'isRunning' in this.nar && typeof this.nar.isRunning === 'function'
                ? this.nar.isRunning()
                : 'state' in this.nar
                    ? this.nar.state === 'started'
                    : false;

        return {
            reasoningTrace: this.monitor.getReasoningTrace().slice(-10),
            performanceTrend: this.monitor.getPerformanceTrend(),
            currentContext: {
                memorySize: memory ? ((memory as { size?: number }).size ?? 0) : 0,
                conceptCount: this.nar.listConcepts().length,
                timestamp: Date.now(),
            },
            performanceMonitors: {
                throughput: (monitorState as MonitorState & { throughput?: number }).throughput ?? 0,
                memoryUsage: process.memoryUsage?.(),
            },
            activeMetaTasks: 0,
            isRunning,
            config,
            stats,
        };
    }

    getReasoningTrace(): unknown[] {
        return this.monitor.getReasoningTrace();
    }

    getReasoningState(): ReasoningState {
        const monitorState = this.monitor.getMonitorState();
        const isRunning =
            this.nar && 'isRunning' in this.nar && typeof this.nar.isRunning === 'function'
                ? this.nar.isRunning()
                : this.nar && 'state' in this.nar
                    ? this.nar.state === 'started'
                    : false;

        return {
            active: isRunning,
            reasoningSteps: monitorState.reasoningSteps,
            performance: monitorState.performance,
            lastUpdate: Date.now(),
            monitorsActive: monitorState.monitorsActive,
            pendingMetaTasks: 0,
        };
    }

    async getSystemAnalysis(): Promise<ReturnType<SelfAnalyzer['getSystemAnalysis']>> {
        return this.analyzer.getSystemAnalysis();
    }

    async assessQuality(): Promise<QualityAssessment> {
        return this.analyzer.assessQuality();
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
                } catch (error) {
                    logger.warn(`Periodic self-analysis error: ${error}`);
                }
            }, this.config.reasoningInterval);
        }
    }
}
