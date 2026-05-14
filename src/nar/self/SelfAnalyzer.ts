import type {NAR} from '../nar.js';
import {MetacognitiveMonitor, type ReasoningStep} from './MetacognitiveMonitor.js';
import type {MetricsCollector} from '../metrics';
import type {Term} from '../terms';
import {isCompound} from '../terms';
import type {Concept} from '../memory';

export interface SelfAnalyzerConfig {
  selfCorrectionEnabled?: boolean;
  patternDetectionEnabled?: boolean;
  optimizationEnabled?: boolean;
}

export interface TermPattern {
  term: string;
  frequency: number;
  coOccurrences: Map<string, number>;
  avgPriority: number;
  lastSeen: number;
}

export interface InferenceChain {
  startTerm: string;
  endTerm: string;
  length: number;
  success: boolean;
  duration: number;
}

export interface PatternAnalysis {
  frequentPatterns: TermPattern[];
  inefficientChains: InferenceChain[];
  successfulStrategies: string[];
  performancePatterns: {
    avgRuleExecutionTime: number;
    avgMemoryUsage: number;
    throughputTrend: 'increasing' | 'decreasing' | 'stable';
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

export interface Optimizations {
  rulePriorities: Array<{ ruleId: string; currentPriority: number; suggestedPriority: number; reason: string }>;
  strategyAdjustments: Array<{ strategy: string; adjustment: string; reason: string }>;
  resourceAllocations: Array<{ resource: string; current: number; suggested: number; reason: string }>;
  performanceImprovements: Array<{ type: string; impact: 'high' | 'medium' | 'low'; action: string; reason: string }>;
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
  performancePatterns: {avgRuleExecutionTime: 0, avgMemoryUsage: 0, throughputTrend: 'stable'},
  resourceUsage: {
    conceptCount: 0,
    memoryUsage: process.memoryUsage?.() ?? {} as NodeJS.MemoryUsage,
    avgConceptPriority: 0,
    highPriorityConcepts: 0,
    lowPriorityConcepts: 0
  },
  taskProcessingPatterns: {avgProcessingTime: 0, queueDepth: 0, dropRate: 0}
});

const calculateAvgPriority = (priorities: number[]): number =>
  priorities.reduce((a, b) => a + b, 0) / (priorities.length || 1);

export class SelfAnalyzer {
  private readonly nar: NAR | null;
  private monitor: MetacognitiveMonitor;
  private readonly metrics: MetricsCollector | null;
  private config: Required<SelfAnalyzerConfig>;
  private readonly MAX_PATTERN_HISTORY_SIZE = 100;
  private patternHistory = new Map<string, number[]>();
  private optimizationHistory: Optimizations = {
    rulePriorities: [],
    strategyAdjustments: [],
    resourceAllocations: [],
    performanceImprovements: []
  };

  constructor(nar: NAR | null, monitor: MetacognitiveMonitor, metrics: MetricsCollector | null, config: SelfAnalyzerConfig = {}) {
    this.nar = nar;
    this.monitor = monitor;
    this.metrics = metrics;
    this.config = {
      selfCorrectionEnabled: config.selfCorrectionEnabled ?? true,
      patternDetectionEnabled: config.patternDetectionEnabled ?? true,
      optimizationEnabled: config.optimizationEnabled ?? true
    };
  }

  async performMetaCognitiveReasoning(): Promise<MetaCognitiveResult> {
    try {
      const patterns = await this.analyzeReasoningPatterns();
      const optimizations = await this.identifyOptimizations(patterns);
      await this.applyOptimizations(optimizations);
      this.trackOptimization(optimizations);

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
      performance: this.getPerformanceAnalysis(),
      resourceUsage: this.getResourceAnalysis(),
      patterns: await this.analyzeReasoningPatterns()
    };
  }

  shutdown(): void {
    this.patternHistory.clear();
    this.optimizationHistory.rulePriorities = [];
    this.optimizationHistory.strategyAdjustments = [];
    this.optimizationHistory.resourceAllocations = [];
    this.optimizationHistory.performanceImprovements = [];
  }

  private async analyzeReasoningPatterns(): Promise<PatternAnalysis> {
    if (!this.nar) return emptyPatternAnalysis();

    const concepts = this.nar.listConcepts();
    const stats = this.nar.getStatistics();

    return {
      frequentPatterns: this.analyzeTermPatterns(concepts),
      inefficientChains: this.detectInefficientChains(),
      successfulStrategies: this.identifySuccessfulStrategies(),
      performancePatterns: this.analyzePerformancePatterns(),
      resourceUsage: this.analyzeResourceUsage(concepts, stats),
      taskProcessingPatterns: this.analyzeTaskPatterns()
    };
  }

  private analyzeTermPatterns(concepts: Concept[]): TermPattern[] {
    const termFreq = new Map<string, { count: number; priorities: number[]; coOccurrences: Map<string, number> }>();

    for (const concept of concepts) {
      const termStr = concept.term.toString();
      if (!termFreq.has(termStr)) {
        termFreq.set(termStr, {count: 0, priorities: [], coOccurrences: new Map()});
      }
      const data = termFreq.get(termStr)!;
      data.count++;
      data.priorities.push(concept.priority);

      for (const neighbor of this.getNeighboringTerms(concept)) {
        const coKey = neighbor.toString();
        if (coKey !== termStr) {
          data.coOccurrences.set(coKey, (data.coOccurrences.get(coKey) || 0) + 1);
        }
      }
    }

    const patterns: TermPattern[] = [];
    for (const [term, data] of termFreq.entries()) {
      patterns.push({
        term,
        frequency: data.count,
        coOccurrences: data.coOccurrences,
        avgPriority: calculateAvgPriority(data.priorities),
        lastSeen: Date.now()
      });
    }

    return patterns.sort((a, b) => b.frequency - a.frequency).slice(0, 20);
  }

  private getNeighboringTerms(concept: Concept): Term[] {
    const neighbors: Term[] = [];
    const term = concept.term as Term;

    if (isCompound(term)) {
      const subject = term.args?.[0];
      const predicate = term.args?.[1];
      if (subject) neighbors.push(subject);
      if (predicate) neighbors.push(predicate);
    }

    return neighbors;
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

  private identifySuccessfulStrategies(): string[] {
    if (!this.metrics) return [];

    const ruleStats = this.metrics.getRuleStats();
    if (!ruleStats || !Array.isArray(ruleStats)) return [];

    const successful = ruleStats.filter(s => s.successes > 0 && s.executions > 0);
    successful.sort((a, b) => (b.successes / b.executions) - (a.successes / a.executions));
    return successful.slice(0, 5).map(s => s.id);
  }

  private analyzePerformancePatterns(): {
    avgRuleExecutionTime: number;
    avgMemoryUsage: number;
    throughputTrend: 'increasing' | 'decreasing' | 'stable'
  } {
    return {
      avgRuleExecutionTime: this.calculateAverageRuleExecutionTime(),
      avgMemoryUsage: this.calculateAverageMemoryUsage(),
      throughputTrend: this.determineThroughputTrend()
    };
  }

  private analyzeResourceUsage(concepts: Concept[], _stats: { totalTasks?: number } | null): {
    conceptCount: number;
    memoryUsage: NodeJS.MemoryUsage;
    avgConceptPriority: number;
    highPriorityConcepts: number;
    lowPriorityConcepts: number
  } {
    return {
      conceptCount: concepts.length,
      memoryUsage: process.memoryUsage?.() ?? {} as NodeJS.MemoryUsage,
      avgConceptPriority: calculateAvgPriority(concepts.map(c => c.priority)),
      highPriorityConcepts: concepts.filter(c => c.priority > 0.7).length,
      lowPriorityConcepts: concepts.filter(c => c.priority < 0.3).length
    };
  }

  private analyzeTaskPatterns(): { avgProcessingTime: number; queueDepth: number; dropRate: number } {
    if (!this.nar || !this.metrics) {
      return {avgProcessingTime: 0, queueDepth: 0, dropRate: 0};
    }

    const metricsSummary = this.metrics.getSummary();
    const stats = this.nar.getStatistics();
    const avgProcessingTime = metricsSummary.throughput?.averageStepDuration ?? 0;
    const totalTasks = stats?.totalTasks ?? 0;

    return {
      avgProcessingTime,
      queueDepth: 0,
      dropRate: totalTasks > 0 ? 0 / totalTasks : 0
    };
  }

  private async identifyOptimizations(patterns: PatternAnalysis): Promise<Optimizations> {
    const optimizations: Optimizations = {
      rulePriorities: [],
      strategyAdjustments: [],
      resourceAllocations: [],
      performanceImprovements: []
    };

    const {conceptCount, lowPriorityConcepts, highPriorityConcepts} = patterns.resourceUsage;
    const {avgRuleExecutionTime} = patterns.performancePatterns;

    if (conceptCount > 80) {
      optimizations.performanceImprovements.push({
        type: 'memory_cleanup',
        impact: 'high',
        action: 'trigger_consolidation',
        reason: `Concept count (${conceptCount}) exceeds threshold (80)`
      });
    }

    if (lowPriorityConcepts > highPriorityConcepts * 2) {
      optimizations.performanceImprovements.push({
        type: 'priority_rebalancing',
        impact: 'medium',
        action: 'adjust_priorities',
        reason: 'Too many low-priority concepts relative to high-priority'
      });
    }

    if (avgRuleExecutionTime > 50) {
      optimizations.performanceImprovements.push({
        type: 'rule_optimization',
        impact: 'medium',
        action: 'optimize_slow_rules',
        reason: `Average rule execution time (${avgRuleExecutionTime}ms) is high`
      });
    }

    return optimizations;
  }

  private async applyOptimizations(optimizations: Optimizations): Promise<void> {
    const handlers = {
      memory_cleanup: () => this.performMemoryCleanup(),
      performance_optimization: () => this.applyPerformanceOptimizations(),
      priority_rebalancing: () => this.rebalancePriorities()
    };

    for (const improvement of optimizations.performanceImprovements) {
      const handler = handlers[improvement.type as keyof typeof handlers];
      if (handler) await handler();
    }
  }

  private async performMemoryCleanup(): Promise<void> {
    this.nar?.memory?.consolidate();
  }

  private async applyPerformanceOptimizations(): Promise<void> {
    if (!this.nar) return;

    const metrics = this.metrics?.getSummary();
    if (!metrics) return;

    const config = this.nar.getConfig();
    const {throughput, system} = metrics;
    const throughputValue = throughput?.derivationsPerSecond ?? 0;
    const errorRate = system?.errors && system.totalDerivations ? system.errors / system.totalDerivations : 0;
    const memoryUsage = process.memoryUsage?.().heapUsed ?? 0;
    const conceptCount = this.nar.listConcepts().length;

    if (throughputValue < 10 && config.maxDerivationsPerStep > 50) {
      this.nar.setConfig({...config, maxDerivationsPerStep: Math.max(50, config.maxDerivationsPerStep - 10)});
    }

    if (errorRate > 0.1 && config.priorityThreshold < 0.7) {
      this.nar.setConfig({...config, priorityThreshold: Math.min(0.7, config.priorityThreshold + 0.05)});
    }

    if (memoryUsage > 100000000 || conceptCount > config.maxConcepts! * 0.9) {
      this.nar.memory?.consolidate();
    }

    const concepts = this.nar.listConcepts();
    const lowPriorityConcepts = concepts.filter(c => c.priority < 0.2);
    if (lowPriorityConcepts.length > concepts.length * 0.5) {
      this.nar.setConfig({...config, priorityThreshold: Math.max(0.1, config.priorityThreshold! - 0.05)});
    }
  }

  private async rebalancePriorities(): Promise<void> {
    if (!this.nar) return;

    for (const concept of this.nar.listConcepts()) {
      if (concept.priority < 0.1 && concept.totalTasks === 0) {
        concept.priority = Math.min(concept.priority + 0.05, 0.15);
      }
    }
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

    const taskPatterns = this.analyzeTaskPatterns();
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
          await this.rebalancePriorities();
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
          await this.applyPerformanceOptimizations();
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

  private trackOptimization(optimizations: Optimizations): void {
    this.optimizationHistory.performanceImprovements.push(...optimizations.performanceImprovements);
    this.optimizationHistory.performanceImprovements =
      this.optimizationHistory.performanceImprovements.slice(-100);

    for (const value of this.patternHistory.values()) {
      if (value.length > this.MAX_PATTERN_HISTORY_SIZE) {
        value.splice(0, value.length - this.MAX_PATTERN_HISTORY_SIZE);
      }
    }
    if (this.patternHistory.size > this.MAX_PATTERN_HISTORY_SIZE) {
      const keysToDelete = Array.from(this.patternHistory.keys())
        .slice(0, this.patternHistory.size - this.MAX_PATTERN_HISTORY_SIZE);
      for (const key of keysToDelete) {
        this.patternHistory.delete(key);
      }
    }
  }

  private calculateAverageRuleExecutionTime(): number {
    if (!this.metrics) return 0;
    const ruleStats = this.metrics.getRuleStats();
    if (!ruleStats || !Array.isArray(ruleStats) || ruleStats.length === 0) return 0;
    return ruleStats.reduce((sum, s) => sum + s.averageDuration, 0) / ruleStats.length;
  }

  private calculateAverageMemoryUsage(): number {
    try {
      const usage = process.memoryUsage();
      return (usage.heapUsed + usage.heapTotal) / 2;
    } catch {
      return 0;
    }
  }

  private determineThroughputTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.patternHistory.size < 2) return 'stable';

    const recent = Array.from(this.patternHistory.values()).slice(-5).flat();
    if (recent.length < 2) return 'stable';

    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const last = recent[recent.length - 1] ?? avg;
    return last > avg * 1.1 ? 'increasing' : last < avg * 0.9 ? 'decreasing' : 'stable';
  }

  private getPerformanceAnalysis(): {
    ruleExecution: number;
    memoryUsage: number;
    throughput: 'increasing' | 'decreasing' | 'stable'
  } {
    return {
      ruleExecution: this.calculateAverageRuleExecutionTime(),
      memoryUsage: this.calculateAverageMemoryUsage(),
      throughput: this.determineThroughputTrend()
    };
  }

  private getResourceAnalysis(): { conceptCount: number; avgPriority: number; memoryUsage: NodeJS.MemoryUsage } {
    if (!this.nar) return {conceptCount: 0, avgPriority: 0, memoryUsage: {} as NodeJS.MemoryUsage};

    const concepts = this.nar.listConcepts();
    return {
      conceptCount: concepts.length,
      avgPriority: calculateAvgPriority(concepts.map(c => c.priority)),
      memoryUsage: process.memoryUsage?.() ?? {} as NodeJS.MemoryUsage
    };
  }
}
