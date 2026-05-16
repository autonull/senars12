import type {NAR} from '../nar.js';
import {MetacognitiveMonitor, type ReasoningStep} from './MetacognitiveMonitor.js';
import type {MetricsCollector} from '../metrics';
import type {Concept} from '../memory';
import {isCompound} from '../terms';
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

export interface TermPattern {
    term: string;
    frequency: number;
    coOccurrences: Map<string, number>;
    avgPriority: number;
    lastSeen: number;
}

export interface PatternAnalysis {
    frequentPatterns: TermPattern[];
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
    performancePatterns: {ruleExecution: 0, memoryUsage: 0, throughput: 'stable'},
    resourceUsage: {
        conceptCount: 0,
        memoryUsage: process.memoryUsage?.() ?? {} as NodeJS.MemoryUsage,
        avgConceptPriority: 0,
        highPriorityConcepts: 0,
        lowPriorityConcepts: 0
    },
    taskProcessingPatterns: {avgProcessingTime: 0, queueDepth: 0, dropRate: 0}
});

const analyzeTermPatterns = (concepts: Concept[]): TermPattern[] => {
    const termFreq = new Map<string, { count: number; priorities: number[]; coOccurrences: Map<string, number> }>();

    for (const concept of concepts) {
        const termStr = concept.term.toString();
        if (!termFreq.has(termStr)) {
            termFreq.set(termStr, {count: 0, priorities: [], coOccurrences: new Map()});
        }
        const data = termFreq.get(termStr)!;
        data.count++;
        data.priorities.push(concept.priority);

        const term = concept.term;
        if (isCompound(term)) {
            for (const neighbor of [term.args?.[0], term.args?.[1]].filter(Boolean)) {
                const coKey = neighbor!.toString();
                if (coKey !== termStr) {
                    data.coOccurrences.set(coKey, (data.coOccurrences.get(coKey) || 0) + 1);
                }
            }
        }
    }

    return Array.from(termFreq.entries(), ([term, data]) => ({
        term,
        frequency: data.count,
        coOccurrences: data.coOccurrences,
        avgPriority: data.priorities.reduce((a, b) => a + b, 0) / (data.priorities.length || 1),
        lastSeen: Date.now()
    })).sort((a, b) => b.frequency - a.frequency).slice(0, 20);
};

const calcAvgPriority = (priorities: number[]): number =>
    priorities.reduce((a, b) => a + b, 0) / (priorities.length || 1);

const analyzePerformancePatterns = (metrics: MetricsCollector | null) => ({
    ruleExecution: metrics ? calcAvgRuleExecutionTime(metrics) : 0,
    memoryUsage: calcAvgMemoryUsage(),
    throughput: 'stable' as const
});

const calcAvgRuleExecutionTime = (metrics: MetricsCollector): number => {
    const ruleStats = metrics.getRuleStats();
    const stats = Array.isArray(ruleStats) ? ruleStats : [];
    if (!stats.length) return 0;
    return stats.reduce((sum: number, s: {averageDuration: number}) => sum + s.averageDuration, 0) / stats.length;
};

const calcAvgMemoryUsage = (): number => {
    try {
        const {heapUsed, heapTotal} = process.memoryUsage();
        return (heapUsed + heapTotal) / 2;
    } catch { return 0; }
};

const identifySuccessfulStrategies = (metrics: MetricsCollector | null): string[] => {
    const ruleStats = metrics?.getRuleStats();
    const stats = Array.isArray(ruleStats) ? ruleStats : [];
    if (!stats.length) return [];
    return stats
        .filter((s: {successes: number; executions: number}) => s.successes > 0 && s.executions > 0)
        .sort((a: {successes: number; executions: number}, b: {successes: number; executions: number}) => (b.successes / b.executions) - (a.successes / a.executions))
        .slice(0, 5)
        .map((s: {id: string}) => s.id);
};

const analyzeTaskPatterns = (nar: NAR | null, metrics: MetricsCollector | null) => {
    if (!nar || !metrics) return {avgProcessingTime: 0, queueDepth: 0, dropRate: 0};
    const stats = nar.getStatistics();
    const avgProcessingTime = metrics.getSummary().throughput?.averageStepDuration ?? 0;
    return {avgProcessingTime, queueDepth: 0, dropRate: 0};
};

export class SelfAnalyzer {
    private readonly nar: NAR | null;
    private readonly monitor: MetacognitiveMonitor;
    private readonly metrics: MetricsCollector | null;
    private readonly optimizer: SelfOptimizer;
    private config: Required<SelfAnalyzerConfig>;

    constructor(nar: NAR | null, monitor: MetacognitiveMonitor, metrics: MetricsCollector | null, config: SelfAnalyzerConfig = {}) {
        this.nar = nar;
        this.monitor = monitor;
        this.metrics = metrics;
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
            performance: analyzePerformancePatterns(this.metrics),
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
            frequentPatterns: analyzeTermPatterns(concepts),
            inefficientChains: this.detectInefficientChains(),
            successfulStrategies: identifySuccessfulStrategies(this.metrics),
            performancePatterns: analyzePerformancePatterns(this.metrics),
            resourceUsage: this.analyzeResourceUsage(concepts, stats),
            taskProcessingPatterns: analyzeTaskPatterns(this.nar, this.metrics)
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

    private analyzeResourceUsage(concepts: Concept[], _stats: { totalTasks?: number } | null) {
        return {
            conceptCount: concepts.length,
            memoryUsage: process.memoryUsage?.() ?? {} as NodeJS.MemoryUsage,
            avgConceptPriority: calcAvgPriority(concepts.map(c => c.priority)),
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

        const taskPatterns = analyzeTaskPatterns(this.nar, this.metrics);
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

    private getResourceAnalysis() {
        if (!this.nar) return {conceptCount: 0, avgPriority: 0, memoryUsage: {} as NodeJS.MemoryUsage};

        const concepts = this.nar.listConcepts();
        return {
            conceptCount: concepts.length,
            avgPriority: calcAvgPriority(concepts.map(c => c.priority)),
            memoryUsage: process.memoryUsage?.() ?? {} as NodeJS.MemoryUsage
        };
    }
}
