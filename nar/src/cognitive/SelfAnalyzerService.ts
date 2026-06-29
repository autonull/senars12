/**
 * SelfAnalyzerService - Self-analysis and optimization service
 *
 * Migrated from: nar/src/self/SelfAnalyzer.ts
 */

import type {Concept} from '../memory';
import type {MetricsCollector} from '../metrics';
import type {NAR} from '../nar.js';
import type {Optimizations} from '../self/SelfOptimizer';
import {SelfOptimizer} from '../self/SelfOptimizer';
import {isCompound} from '../terms';
import type {MetacognitiveMonitor, ReasoningStep} from './MetacognitiveMonitor.js';

export interface SelfAnalyzerConfig {
    selfCorrectionEnabled?: boolean;
    patternDetectionEnabled?: boolean;
    optimizationEnabled?: boolean;
    recencyEpisodes?: number;
}

export interface AgentPolicy {
    routingWeights: Record<string, number>;
    toolSelectionBias: Record<string, number>;
    promptBudget: number;
    recencyEpisodes: number;
    updatedAt: number;
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
    performancePatterns: PerformancePatterns;
    resourceUsage: ResourceUsage;
    taskProcessingPatterns: TaskPatterns;
}

export interface MonitorState {
    reasoningSteps: number;
    performance: string;
    lastUpdate: number;
    monitorsActive: number;
    reasoningTrace?: ReasoningStep[];
    throughput?: number;
}

export interface QualityAssessment {
    overall: number;
    coherence: number;
    relevance: number;
    completeness: number;
    timestamp: number;
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
        duration?: number;
    }>;
    resourceIssues: Array<{
        type: string;
        severity: string;
        value?: number;
        percentile?: number;
        description: string;
    }>;
    performanceIssues: Array<{
        type: string;
        severity: string;
        description: string;
        value?: number;
    }>;
}

export interface CorrectionResult {
    appliedCorrections: AppliedCorrection[];
    pendingCorrections: PendingCorrection[];
}

interface PerformancePatterns {
    ruleExecution: number;
    memoryUsage: number;
    throughput: 'increasing' | 'decreasing' | 'stable';
}

interface ResourceUsage {
    conceptCount: number;
    memoryUsage: NodeJS.MemoryUsage;
    avgConceptPriority: number;
    highPriorityConcepts: number;
    lowPriorityConcepts: number;
}

export interface CapabilitySnapshot {
    timestamp: number;
    activeRules: string[];
    activeTools: string[];
    lmProviders: string[];
    pipelineStages: string[];
    memoryState: { concepts: number; beliefs: number; episodes: number };
}

export interface CapabilityDiff {
    added: string[];
    removed: string[];
    changed: { name: string; before: string; after: string }[];
}

interface TaskPatterns {
    avgProcessingTime: number;
    queueDepth: number;
    dropRate: number;
}

interface AppliedCorrection {
    type: string;
    issue: string;
}

interface PendingCorrection {
    type: string;
    issue: string;
    reason: string;
}

const EMPTY_PATTERN: PatternAnalysis = {
    frequentPatterns: [],
    inefficientChains: [],
    successfulStrategies: [],
    performancePatterns: {ruleExecution: 0, memoryUsage: 0, throughput: 'stable' as const},
    resourceUsage: {
        conceptCount: 0,
        memoryUsage: process.memoryUsage?.() ?? ({} as NodeJS.MemoryUsage),
        avgConceptPriority: 0,
        highPriorityConcepts: 0,
        lowPriorityConcepts: 0,
    },
    taskProcessingPatterns: {avgProcessingTime: 0, queueDepth: 0, dropRate: 0},
};

const calcAvg = (values: number[]): number =>
    values.reduce((a, b) => a + b, 0) / (values.length || 1);

const getMemory = () => process.memoryUsage?.() ?? ({} as NodeJS.MemoryUsage);

const analyzeTermPatterns = (concepts: Concept[]): TermPattern[] => {
    const termFreq = new Map<
        string,
        { count: number; priorities: number[]; coOccurrences: Map<string, number> }
    >();

    for (const concept of concepts) {
        const termStr = concept.term.toString();
        if (!termFreq.has(termStr)) {
            termFreq.set(termStr, {count: 0, priorities: [], coOccurrences: new Map()});
        }
        const data = termFreq.get(termStr)!;
        data.count++;
        data.priorities.push(concept.priority);

        if (isCompound(concept.term)) {
            for (const neighbor of [concept.term.args?.[0], concept.term.args?.[1]].filter(Boolean)) {
                const coKey = neighbor!.toString();
                if (coKey !== termStr)
                    data.coOccurrences.set(coKey, (data.coOccurrences.get(coKey) || 0) + 1);
            }
        }
    }

    return Array.from(termFreq.entries(), ([term, data]) => ({
        term,
        frequency: data.count,
        coOccurrences: data.coOccurrences,
        avgPriority: calcAvg(data.priorities),
        lastSeen: Date.now(),
    }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 20);
};

const analyzePerformancePatterns = (metrics: MetricsCollector | null): PerformancePatterns => {
    const ruleStats = metrics?.getRuleStats();
    const avgDuration = Array.isArray(ruleStats)
        ? calcAvg(ruleStats.map((s) => s.averageDuration))
        : 0;
    return {
        ruleExecution: avgDuration,
        memoryUsage: (() => {
            try {
                const {heapUsed, heapTotal} = process.memoryUsage();
                return (heapUsed + heapTotal) / 2;
            } catch {
                return 0;
            }
        })(),
        throughput: 'stable' as const,
    };
};

const identifySuccessfulStrategies = (metrics: MetricsCollector | null): string[] => {
    const ruleStats = metrics?.getRuleStats();
    const stats = Array.isArray(ruleStats) ? ruleStats : [];
    if (!stats.length) return [];
    return stats
        .filter((s) => s.successes > 0 && s.executions > 0)
        .sort((a, b) => b.successes / b.executions - a.successes / a.executions)
        .slice(0, 5)
        .map((s) => s.id);
};

const analyzeTaskPatterns = (nar: NAR | null, metrics: MetricsCollector | null): TaskPatterns =>
    nar && metrics
        ? {
            avgProcessingTime: metrics.getSummary().throughput?.averageStepDuration ?? 0,
            queueDepth: 0,
            dropRate: 0,
        }
        : {avgProcessingTime: 0, queueDepth: 0, dropRate: 0};

export class SelfAnalyzerService {
    private readonly nar: NAR | null;
    private readonly monitor: MetacognitiveMonitor;
    private readonly metrics: MetricsCollector | null;
    private readonly optimizer: SelfOptimizer;
    private config: Required<SelfAnalyzerConfig>;
    private recentRoutes: string[] = [];
    private recentTools: string[] = [];
    private policy: AgentPolicy = {
        routingWeights: {
            narsese: 1,
            nl: 1,
            reason: 1,
            command: 1,
            narsese_belief: 1,
            narsese_question: 1,
        },
        toolSelectionBias: {},
        promptBudget: 2048,
        recencyEpisodes: 20,
        updatedAt: 0,
    };

    constructor(
        nar: NAR | null,
        monitor: MetacognitiveMonitor,
        metrics: MetricsCollector | null,
        config: SelfAnalyzerConfig = {}
    ) {
        this.nar = nar;
        this.monitor = monitor;
        this.metrics = metrics;
        this.optimizer = new SelfOptimizer(nar, metrics);
        this.config = {
            selfCorrectionEnabled: config.selfCorrectionEnabled ?? true,
            patternDetectionEnabled: config.patternDetectionEnabled ?? true,
            optimizationEnabled: config.optimizationEnabled ?? true,
            recencyEpisodes: config.recencyEpisodes ?? 20,
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
                monitorState: this.monitor.getMonitorState(),
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: Date.now(),
                monitorState: this.monitor.getMonitorState(),
            };
        }
    }

    async performSelfCorrection(): Promise<MetaCognitiveResult> {
        try {
            await this.applyCorrections(await this.identifyIssues());
            return {
                success: true,
                timestamp: Date.now(),
                monitorState: this.monitor.getMonitorState(),
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: Date.now(),
            };
        }
    }

    async getSystemAnalysis(): Promise<{
        metaCognition: MonitorState;
        performance: PerformancePatterns;
        resourceUsage: Omit<ResourceUsage, 'highPriorityConcepts' | 'lowPriorityConcepts'>;
        patterns: PatternAnalysis;
    }> {
        return {
            metaCognition: this.monitor.getMonitorState(),
            performance: analyzePerformancePatterns(this.metrics),
            resourceUsage: this.getResourceAnalysis(),
            patterns: await this.analyzeReasoningPatterns(),
        };
    }

    shutdown(): void {
        this.optimizer.getOptimizationHistory();
    }

    applyOptimizations(): void {
        this.optimizer
            .applyOptimizations({
                rulePriorities: [],
                strategyAdjustments: [],
                resourceAllocations: [],
                performanceImprovements: [],
            })
            .catch((e) => {
                console.warn(`applyOptimizations failed: ${e}`);
            });
    }

    /**
     * Record the most recent route kind (Phase 8, invariant I10).
     * Used to bias routing weights toward the dominant pattern.
     */
    recordRoute(kind: string): void {
        const cap = this.config.recencyEpisodes;
        this.recentRoutes.push(kind);
        if (this.recentRoutes.length > cap) {
            this.recentRoutes.splice(0, this.recentRoutes.length - cap);
        }
    }

    /**
     * Record the most recent tool call (Phase 8, invariant I10).
     * Used to bias tool selection.
     */
    recordTool(name: string): void {
        const cap = this.config.recencyEpisodes;
        this.recentTools.push(name);
        if (this.recentTools.length > cap) {
            this.recentTools.splice(0, this.recentTools.length - cap);
        }
    }

    /**
     * Recompute the behavioural policy from the rolling window. Returns the
     * new policy. The policy is also cached on the instance for
     * `getPolicy()`.
     */
    recomputePolicy(): AgentPolicy {
        const routeCounts = new Map<string, number>();
        for (const r of this.recentRoutes) routeCounts.set(r, (routeCounts.get(r) ?? 0) + 1);
        const totalRoutes = Math.max(1, this.recentRoutes.length);
        const routingWeights: Record<string, number> = {};
        for (const [kind, count] of routeCounts) {
            routingWeights[kind] = Math.max(0.1, count / totalRoutes);
        }
        // Keep a stable baseline for the standard kinds
        for (const k of ['narsese-belief', 'narsese-question', 'command', 'nl', 'reason']) {
            if (!(k in routingWeights)) routingWeights[k] = 0.1;
        }

        const toolCounts = new Map<string, number>();
        for (const t of this.recentTools) toolCounts.set(t, (toolCounts.get(t) ?? 0) + 1);
        const toolSelectionBias: Record<string, number> = {};
        for (const [name, count] of toolCounts) {
            toolSelectionBias[name] = Math.max(0.1, count / Math.max(1, this.recentTools.length));
        }

        // Prompt budget: shrink if average processing time is high
        const perf = analyzePerformancePatterns(this.metrics);
        const budget = perf.ruleExecution > 50 ? 1024 : 2048;

        this.policy = {
            routingWeights,
            toolSelectionBias,
            promptBudget: budget,
            recencyEpisodes: this.config.recencyEpisodes,
            updatedAt: Date.now(),
        };
        return this.policy;
    }

    getPolicy(): AgentPolicy {
        return this.policy;
    }

    async assessQuality(): Promise<QualityAssessment> {
        if (!this.nar) {
            return {overall: 0, coherence: 0, relevance: 0, completeness: 0, timestamp: Date.now()};
        }
        const beliefs = this.nar.getBeliefs();

        // Coherence: based on contradiction detection and consistency
        const contradictions = this.nar.getConstitution?.()?.length ?? 0;
        const coherence = Math.max(0, 1 - contradictions * 0.1);

        // Relevance: based on active goals and belief alignment
        const goals = this.nar.getGoals?.() ?? [];
        const relevantBeliefs = beliefs.filter((b) =>
            goals.some((g) => b.term.toString().includes(g.term.toString().split('-->')[0]?.trim() ?? ''))
        ).length;
        const relevance = goals.length > 0 ? Math.min(1, relevantBeliefs / goals.length) : 0.5;

        // Completeness: based on question resolution rate
        const questions = this.nar.getQuestions?.() ?? [];
        const answeredQuestions = questions.filter((q) =>
            beliefs.some((b) => b.term.toString().includes(q.term.toString().replace('?', '').trim()))
        ).length;
        const completeness = questions.length > 0 ? answeredQuestions / questions.length : 0.5;

        // Overall: weighted average
        const overall = coherence * 0.4 + relevance * 0.3 + completeness * 0.3;

        return {
            overall: Math.round(overall * 100) / 100,
            coherence: Math.round(coherence * 100) / 100,
            relevance: Math.round(relevance * 100) / 100,
            completeness: Math.round(completeness * 100) / 100,
            timestamp: Date.now(),
        };
    }

    async getCapabilitySnapshot(): Promise<CapabilitySnapshot> {
        if (!this.nar) {
            return {
                timestamp: Date.now(),
                activeRules: [],
                activeTools: [],
                lmProviders: [],
                pipelineStages: [],
                memoryState: {concepts: 0, beliefs: 0, episodes: 0},
            };
        }

        const beliefs = this.nar.getBeliefs();
        const concepts = this.nar.listConcepts();

        return {
            timestamp: Date.now(),
            activeRules: ['deduction', 'induction', 'abduction', 'revision', 'analogy'],
            activeTools: ['search', 'read', 'write', 'http'],
            lmProviders: this.nar.getLMClient ? [this.nar.getLMClient()?.provider || 'none'] : [],
            pipelineStages: [
                'InputNormalizer',
                'AuthChecker',
                'SeNARSProcessor',
                'LMResponder',
                'ResponseComposer',
            ],
            memoryState: {
                concepts: concepts.length,
                beliefs: beliefs.length,
                episodes: 0,
            },
        };
    }

    diffCapabilities(before: CapabilitySnapshot, after: CapabilitySnapshot): CapabilityDiff {
        const added: string[] = [];
        const removed: string[] = [];
        const changed: { name: string; before: string; after: string }[] = [];

        for (const rule of after.activeRules) {
            if (!before.activeRules.includes(rule)) added.push(rule);
        }
        for (const rule of before.activeRules) {
            if (!after.activeRules.includes(rule)) removed.push(rule);
        }

        if (after.memoryState.concepts !== before.memoryState.concepts) {
            changed.push({
                name: 'concepts',
                before: String(before.memoryState.concepts),
                after: String(after.memoryState.concepts),
            });
        }
        if (after.memoryState.beliefs !== before.memoryState.beliefs) {
            changed.push({
                name: 'beliefs',
                before: String(before.memoryState.beliefs),
                after: String(after.memoryState.beliefs),
            });
        }

        return {added, removed, changed};
    }

    private async analyzeReasoningPatterns(): Promise<PatternAnalysis> {
        if (!this.nar) return EMPTY_PATTERN;
        const concepts = this.nar.listConcepts();
        return {
            frequentPatterns: analyzeTermPatterns(concepts),
            inefficientChains: this.detectInefficientChains(),
            successfulStrategies: identifySuccessfulStrategies(this.metrics),
            performancePatterns: analyzePerformancePatterns(this.metrics),
            resourceUsage: this.analyzeResourceUsage(concepts),
            taskProcessingPatterns: analyzeTaskPatterns(this.nar, this.metrics),
        };
    }

    private detectInefficientChains(): InferenceChain[] {
        const monitorState = this.monitor.getMonitorState();
        if (!monitorState?.reasoningTrace) return [];
        return monitorState.reasoningTrace.slice(-100).reduce<InferenceChain[]>(
            (acc: InferenceChain[], entry: ReasoningStep) =>
                entry.stepData.duration !== undefined && entry.stepData.duration > 1000
                    ? [
                        ...acc,
                        {
                            startTerm: entry.stepData.startTerm || 'unknown',
                            endTerm: entry.stepData.endTerm || 'unknown',
                            length: 1,
                            success: entry.stepData.success ?? false,
                            duration: entry.stepData.duration,
                        },
                    ]
                    : acc,
            []
        );
    }

    private analyzeResourceUsage(concepts: Concept[]): ResourceUsage {
        const priorities = concepts.map((c) => c.priority);
        return {
            conceptCount: concepts.length,
            memoryUsage: getMemory(),
            avgConceptPriority: calcAvg(priorities),
            highPriorityConcepts: concepts.filter((c) => c.priority > 0.7).length,
            lowPriorityConcepts: concepts.filter((c) => c.priority < 0.3).length,
        };
    }

    private async identifyIssues(): Promise<IdentifiedIssues> {
        const issues: IdentifiedIssues = {
            contradictions: [],
            inefficiencies: [],
            resourceIssues: [],
            performanceIssues: [],
        };
        if (!this.nar) return issues;

        const concepts = this.nar.listConcepts();
        const lowPriorityRatio =
            concepts.filter((c) => c.priority < 0.2).length / (concepts.length || 1);

        if (lowPriorityRatio > 0.5)
            issues.resourceIssues.push({
                type: 'high_low_priority_ratio',
                severity: 'medium',
                value: lowPriorityRatio,
                description: 'Over 50% of concepts have low priority',
            });

        if (concepts.length > 100)
            issues.resourceIssues.push({
                type: 'high_concept_count',
                severity: 'high',
                value: concepts.length,
                description: 'Concept count exceeds recommended limit',
            });

        const inefficientChains = this.detectInefficientChains();
        if (inefficientChains.length > 0)
            issues.inefficiencies.push(
                ...inefficientChains.map((chain) => ({
                    type: 'slow_inference_chain',
                    severity: 'medium',
                    description: `Inference chain from ${chain.startTerm} to ${chain.endTerm} took ${chain.duration}ms`,
                    ...chain,
                }))
            );

        if (this.monitor.getMonitorState().performance === 'declining')
            issues.performanceIssues.push({
                type: 'declining_performance',
                severity: 'high',
                description: 'System performance is declining over time',
            });

        const taskPatterns = analyzeTaskPatterns(this.nar, this.metrics);
        if (taskPatterns.dropRate > 0.1)
            issues.performanceIssues.push({
                type: 'high_task_drop_rate',
                severity: 'high',
                value: taskPatterns.dropRate,
                description: 'More than 10% of tasks are being dropped',
            });

        return issues;
    }

    private async applyCorrections(issues: IdentifiedIssues): Promise<CorrectionResult> {
        const appliedCorrections: AppliedCorrection[] = [];
        const pendingCorrections: PendingCorrection[] = [];
        if (!this.nar) return {appliedCorrections, pendingCorrections};

        for (const issue of issues.resourceIssues || []) {
            if (issue.type === 'high_low_priority_ratio') {
                await this.optimizer.rebalancePriorities();
                appliedCorrections.push({
                    type: 'priority_rebalancing',
                    issue: 'high_low_priority_ratio',
                });
            } else if (issue.type === 'high_concept_count') {
                if (this.nar.memory) {
                    this.nar.memory.consolidate();
                    appliedCorrections.push({
                        type: 'memory_consolidation',
                        issue: 'high_concept_count',
                    });
                } else {
                    pendingCorrections.push({
                        type: 'memory_consolidation',
                        issue: 'high_concept_count',
                        reason: 'consolidation not available',
                    });
                }
            }
        }

        for (const issue of issues.performanceIssues || []) {
            if (issue.type === 'declining_performance') {
                await this.optimizer.applyPerformanceOptimizations();
                appliedCorrections.push({
                    type: 'performance_optimization',
                    issue: 'declining_performance',
                });
            } else if (issue.type === 'high_task_drop_rate') {
                const config = this.nar.getConfig();
                this.nar.setConfig({
                    ...config,
                    maxDerivationsPerStep: Math.max(50, (config.maxDerivationsPerStep || 100) - 20),
                });
                appliedCorrections.push({
                    type: 'throttle_reduction',
                    issue: 'high_task_drop_rate',
                });
            }
        }

        for (const issue of issues.inefficiencies || []) {
            if (issue.type === 'slow_inference_chain')
                pendingCorrections.push({
                    type: 'chain_optimization',
                    issue: 'slow_inference_chain',
                    reason: 'Requires manual review',
                });
        }

        return {appliedCorrections, pendingCorrections};
    }

    private getResourceAnalysis(): Omit<
        ResourceUsage,
        'highPriorityConcepts' | 'lowPriorityConcepts'
    > {
        if (!this.nar) return {conceptCount: 0, avgConceptPriority: 0, memoryUsage: getMemory()};
        const concepts = this.nar.listConcepts();
        return {
            conceptCount: concepts.length,
            avgConceptPriority: calcAvg(concepts.map((c) => c.priority)),
            memoryUsage: getMemory(),
        };
    }
}
