import type {NAR} from '../nar.js';
import {MetacognitiveMonitor, type ReasoningStep} from './MetacognitiveMonitor.js';
import type {MetricsCollector} from '../metrics';
import type {Concept} from '../memory';
import {PatternAnalyzer} from './PatternAnalyzer.js';
import {PerformanceAnalyzer} from './PerformanceAnalyzer.js';
import {SelfOptimizer, type Optimizations} from './SelfOptimizer.js';

export interface SelfAnalyzerConfig {
    selfCorrectionEnabled?: boolean;
    patternDetectionEnabled?: boolean;
    optimizationEnabled?: boolean;
}

export interface InferenceChain {
    startTerm: string;
    endTerm: string;
    length: number;
    success: boolean;
    duration: number;
}

export interface PatternAnalysis {
    frequentPatterns: Array<{ term: string; frequency: number; coOccurrences: Map<string, number>; avgPriority: number; lastSeen: number }>;
    inefficientChains: InferenceChain[];
    successfulStrategies: string[];
    performancePatterns: {
        ruleExecution: number;
        memoryUsage: number;
        throughput: 'increasing' | 'decreasing' | 'stable';
    };
    resourceUsage: {
        conceptCount: number;
        memoryUsage: NodeJS.MemoryUsage;
        avgConceptPriority: number;
        highPriorityConcepts: number;
        lowPriorityConcepts: number;
    };
    taskProcessingPatterns: {
        avgProcessingTime: number;
        queueDepth: number;
        dropRate: number;
    };
}

export interface MonitorState {
    reasoningSteps: number;
    performance: string;
    lastUpdate: number;
    monitorsActive: number;
    reasoningTrace?: ReasoningStep[];
    throughput?: number;
}

export type {ReasoningStep};

export interface MetaCognitiveResult {
    success: boolean;
    patterns?: PatternAnalysis;
    optimizations?: Optimizations;
    tasksProcessed?: number;
    timestamp?: number;
    error?: string;
    monitorState?: MonitorState;
}

export interface IdentifiedIssues {
    contradictions: Array<{ type: string; severity: string; description: string }>;
    inefficiencies: Array<{
        type: string;
        severity: string;
        description: string;
        startTerm?: string;
        endTerm?: string;
        length?: number;
        success?: boolean;
        duration?: number
    }>;
    resourceIssues: Array<{ type: string; severity: string; value?: number; threshold?: number; description: string }>;
    performanceIssues: Array<{
        type: string;
        severity: string;
        description: string;
        value?: number;
        threshold?: number
    }>;
}

export interface AppliedCorrection {
    type: string;
    issue: string;
}

export interface PendingCorrection {
    type: string;
    issue: string;
    reason: string;
}

export interface CorrectionResult {
    appliedCorrections: AppliedCorrection[];
    pendingCorrections: PendingCorrection[];
}

const emptyPatternAnalysis = (): PatternAnalysis => ({
    frequentPatterns: [],
    inefficientChains: [],
    successfulStrategies: [],
    performancePatterns: {ruleExecution: 0, memoryUsage: 0, throughput: 'stable' as const},
    resourceUsage: {
        conceptCount: 0,
        memoryUsage: process.memoryUsage?.() ?? {} as NodeJS.MemoryUsage,
        avgConceptPriority: 0,
        highPriorityConcepts: 0,
        lowPriorityConcepts: 0
    },
    taskProcessingPatterns: {avgProcessingTime: 0, queueDepth: 0, dropRate: 0}
});

export class SelfAnalyzer {
    private readonly nar: NAR | null;
    private readonly monitor: MetacognitiveMonitor;
    private readonly metrics: MetricsCollector | null;
    private readonly patternAnalyzer: PatternAnalyzer;
    private readonly performanceAnalyzer: PerformanceAnalyzer;
    private readonly optimizer: SelfOptimizer;
    private config: Required<SelfAnalyzerConfig>;

    constructor(nar: NAR | null, monitor: MetacognitiveMonitor, metrics: MetricsCollector | null, config: SelfAnalyzerConfig = {}) {
        this.nar = nar;
        this.monitor = monitor;
        this.metrics = metrics;
        this.patternAnalyzer = new PatternAnalyzer();
        this.performanceAnalyzer = new PerformanceAnalyzer(metrics);
        this.optimizer = new SelfOptimizer(nar, metrics);
        this.config = {
            selfCorrectionEnabled: config.selfCorrectionEnabled ?? true,
            patternDetectionEnabled: config.patternDetectionEnabled ?? true,
            optimizationEnabled: config.optimizationEnabled ?? true
        };
    }

    async performMetaCognitiveReasoning(): Promise<MetaCognitiveResult> {
        try {
            const patterns = await this.analyzeReasoningPatterns();
            const optimizations = await this.optimizer.identifyOptimizations(
                patterns.resourceUsage.conceptCount,
                patterns.resourceUsage.lowPriorityConcepts,
                patterns.resourceUsage.highPriorityConcepts,
                patterns.performancePatterns.ruleExecution
            );
            await this.optimizer.applyOptimizations(optimizations);
            this.optimizer.trackOptimization(optimizations);

            return {
                success: true,
                patterns,
                optimizations,
                timestamp: Date.now(),
                monitorState: this.monitor.getMonitorState()
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now(),
                monitorState: this.monitor.getMonitorState()
            };
        }
    }

    async performSelfCorrection(): Promise<MetaCognitiveResult> {
        try {
            const issues = await this.identifyIssues();
            await this.applyCorrections(issues);

            return {
                success: true,
                timestamp: Date.now(),
                monitorState: this.monitor.getMonitorState()
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now()
            };
        }
    }

    async getSystemAnalysis(): Promise<{
        metaCognition: MonitorState;
        performance: { ruleExecution: number; memoryUsage: number; throughput: 'increasing' | 'decreasing' | 'stable' };
        resourceUsage: { conceptCount: number; avgPriority: number; memoryUsage: NodeJS.MemoryUsage };
        patterns: PatternAnalysis;
    }> {
        return {
            metaCognition: this.monitor.getMonitorState(),
            performance: this.performanceAnalyzer.analyzePerformancePatterns(),
            resourceUsage: this.getResourceAnalysis(),
            patterns: await this.analyzeReasoningPatterns()
        };
    }

    shutdown(): void {
        this.optimizer.getOptimizationHistory();
    }

    applyOptimizations(): void {
        this.optimizer.applyOptimizations({
            rulePriorities: [],
            strategyAdjustments: [],
            resourceAllocations: [],
            performanceImprovements: []
        }).catch(() => {});
    }

    private async analyzeReasoningPatterns(): Promise<PatternAnalysis> {
        if (!this.nar) return emptyPatternAnalysis();

        const concepts = this.nar.listConcepts();
        const stats = this.nar.getStatistics();

        return {
            frequentPatterns: this.patternAnalyzer.analyzeTermPatterns(concepts),
            inefficientChains: this.detectInefficientChains(),
            successfulStrategies: this.performanceAnalyzer.identifySuccessfulStrategies(),
            performancePatterns: this.performanceAnalyzer.analyzePerformancePatterns(),
            resourceUsage: this.analyzeResourceUsage(concepts, stats),
            taskProcessingPatterns: this.performanceAnalyzer.analyzeTaskPatterns(this.nar)
        };
    }

    private detectInefficientChains(): InferenceChain[] {
        const inefficient: InferenceChain[] = [];
        const monitorState = this.monitor.getMonitorState();

        if (monitorState?.reasoningTrace) {
            for (const entry of monitorState.reasoningTrace.slice(-100)) {
                const duration = entry.stepData.duration;
                if (duration !== undefined && duration > 1000) {
                    inefficient.push({
                        startTerm: entry.stepData.startTerm || 'unknown',
                        endTerm: entry.stepData.endTerm || 'unknown',
                        length: 1,
                        success: entry.stepData.success ?? false,
                        duration
                    });
                }
            }
        }

        return inefficient;
    }

    private analyzeResourceUsage(concepts: Concept[], _stats: { totalTasks?: number } | null): {
        conceptCount: number;
        memoryUsage: NodeJS.MemoryUsage;
        avgConceptPriority: number;
        highPriorityConcepts: number;
        lowPriorityConcepts: number
    } {
        const avgPriority = this.patternAnalyzer.calculateAvgPriority(concepts.map(c => c.priority));
        return {
            conceptCount: concepts.length,
            memoryUsage: process.memoryUsage?.() ?? {} as NodeJS.MemoryUsage,
            avgConceptPriority: avgPriority,
            highPriorityConcepts: concepts.filter(c => c.priority > 0.7).length,
            lowPriorityConcepts: concepts.filter(c => c.priority < 0.3).length
        };
    }

    private async identifyIssues(): Promise<IdentifiedIssues> {
        const issues: IdentifiedIssues = {
            contradictions: [],
            inefficiencies: [],
            resourceIssues: [],
            performanceIssues: []
        };

        if (!this.nar) return issues;

        const concepts = this.nar.listConcepts();
        const lowPriorityRatio = concepts.filter(c => c.priority < 0.2).length / (concepts.length || 1);

        if (lowPriorityRatio > 0.5) {
            issues.resourceIssues.push({
                type: 'high_low_priority_ratio',
                severity: 'medium',
                value: lowPriorityRatio,
                threshold: 0.5,
                description: 'Over 50% of concepts have low priority'
            });
        }

        if (concepts.length > 100) {
            issues.resourceIssues.push({
                type: 'high_concept_count',
                severity: 'high',
                value: concepts.length,
                threshold: 100,
                description: 'Concept count exceeds recommended limit'
            });
        }

        const inefficientChains = this.detectInefficientChains();
        if (inefficientChains.length > 0) {
            issues.inefficiencies.push(...inefficientChains.map(chain => ({
                type: 'slow_inference_chain',
                severity: 'medium',
                description: `Inference chain from ${chain.startTerm} to ${chain.endTerm} took ${chain.duration}ms`,
                ...chain
            })));
        }

        const monitorState = this.monitor.getMonitorState();
        if (monitorState.performance === 'declining') {
            issues.performanceIssues.push({
                type: 'declining_performance',
                severity: 'high',
                description: 'System performance is declining over time'
            });
        }

        const taskPatterns = this.performanceAnalyzer.analyzeTaskPatterns(this.nar);
        if (taskPatterns.dropRate > 0.1) {
            issues.performanceIssues.push({
                type: 'high_task_drop_rate',
                severity: 'high',
                value: taskPatterns.dropRate,
                threshold: 0.1,
                description: 'More than 10% of tasks are being dropped'
            });
        }

        return issues;
    }

    private async applyCorrections(issues: IdentifiedIssues): Promise<CorrectionResult> {
        const appliedCorrections: AppliedCorrection[] = [];
        const pendingCorrections: PendingCorrection[] = [];

        if (!this.nar) return {appliedCorrections, pendingCorrections};

        for (const issue of issues.resourceIssues || []) {
            switch (issue.type) {
                case 'high_low_priority_ratio':
                    await this.optimizer.rebalancePriorities();
                    appliedCorrections.push({type: 'priority_rebalancing', issue: 'high_low_priority_ratio'});
                    break;
                case 'high_concept_count':
                    if (this.nar.memory) {
                        this.nar.memory.consolidate();
                        appliedCorrections.push({type: 'memory_consolidation', issue: 'high_concept_count'});
                    } else {
                        pendingCorrections.push({
                            type: 'memory_consolidation',
                            issue: 'high_concept_count',
                            reason: 'consolidation not available'
                        });
                    }
                    break;
            }
        }

        for (const issue of issues.performanceIssues || []) {
            switch (issue.type) {
                case 'declining_performance':
                    await this.optimizer.applyPerformanceOptimizations();
                    appliedCorrections.push({type: 'performance_optimization', issue: 'declining_performance'});
                    break;
                case 'high_task_drop_rate':
                    const config = this.nar.getConfig();
                    this.nar.setConfig({
                        ...config,
                        maxDerivationsPerStep: Math.max(50, (config.maxDerivationsPerStep || 100) - 20)
                    });
                    appliedCorrections.push({type: 'throttle_reduction', issue: 'high_task_drop_rate'});
                    break;
            }
        }

        for (const issue of issues.inefficiencies || []) {
            if (issue.type === 'slow_inference_chain') {
                pendingCorrections.push({
                    type: 'chain_optimization',
                    issue: 'slow_inference_chain',
                    reason: 'Requires manual review of inference chain'
                });
            }
        }

        return {appliedCorrections, pendingCorrections};
    }

    private getResourceAnalysis(): { conceptCount: number; avgPriority: number; memoryUsage: NodeJS.MemoryUsage } {
        if (!this.nar) return {conceptCount: 0, avgPriority: 0, memoryUsage: {} as NodeJS.MemoryUsage};

        const concepts = this.nar.listConcepts();
        return {
            conceptCount: concepts.length,
            avgPriority: this.patternAnalyzer.calculateAvgPriority(concepts.map(c => c.priority)),
            memoryUsage: process.memoryUsage?.() ?? {} as NodeJS.MemoryUsage
        };
    }
}