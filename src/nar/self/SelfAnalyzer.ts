import type {NAR} from '../nar.js';
import {MetacognitiveMonitor} from './MetacognitiveMonitor.js';
import type {MetricsCollector} from '../metrics/index.js';

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

export interface MetaCognitiveResult {
  success: boolean;
  patterns?: PatternAnalysis;
  optimizations?: Optimizations;
  tasksProcessed?: number;
  timestamp?: number;
  error?: string;
  monitorState?: any;
}

export class SelfAnalyzer {
  private nar: NAR | null;
  private monitor: MetacognitiveMonitor;
  private metrics: MetricsCollector | null;
  private config: Required<SelfAnalyzerConfig>;
  private patternHistory: Map<string, number[]> = new Map();
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
      const corrections = await this.applyCorrections(issues);

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

  async getSystemAnalysis(): Promise<any> {
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
    if (!this.nar) {
      return this.emptyPatternAnalysis();
    }

    const concepts = this.nar.listConcepts();
    const stats = this.nar.getStatistics();
    const metricsSummary = this.metrics?.getSummary();

    const termPatterns = this.analyzeTermPatterns(concepts);
    const inferenceChains = this.detectInefficientChains();
    const performancePatterns = this.analyzePerformancePatterns(metricsSummary);
    const resourceUsage = this.analyzeResourceUsage(concepts, stats);
    const taskPatterns = this.analyzeTaskPatterns();

    return {
      frequentPatterns: termPatterns,
      inefficientChains: inferenceChains,
      successfulStrategies: this.identifySuccessfulStrategies(),
      performancePatterns,
      resourceUsage,
      taskProcessingPatterns: taskPatterns
    };
  }

  private analyzeTermPatterns(concepts: any[]): TermPattern[] {
    const termFreq = new Map<string, { count: number; priorities: number[]; coOccurrences: Map<string, number> }>();

    for (const concept of concepts) {
      const termStr = concept.term.toString();
      if (!termFreq.has(termStr)) {
        termFreq.set(termStr, { count: 0, priorities: [], coOccurrences: new Map() });
      }
      const data = termFreq.get(termStr)!;
      data.count++;
      data.priorities.push(concept.priority);

      const neighbors = this.getNeighboringTerms(concept);
      for (const neighbor of neighbors) {
        const coKey = neighbor.toString();
        if (coKey !== termStr) {
          data.coOccurrences.set(coKey, (data.coOccurrences.get(coKey) || 0) + 1);
        }
      }
    }

    const patterns: TermPattern[] = [];
    for (const [term, data] of termFreq.entries()) {
      const avgPriority = data.priorities.reduce((a, b) => a + b, 0) / data.priorities.length;
      patterns.push({
        term,
        frequency: data.count,
        coOccurrences: data.coOccurrences,
        avgPriority,
        lastSeen: Date.now()
      });
    }

    return patterns.sort((a, b) => b.frequency - a.frequency).slice(0, 20);
  }

  private getNeighboringTerms(concept: any): any[] {
    const neighbors: any[] = [];
    const term = concept.term;
    const subject = (term as any).args?.[0];
    const predicate = (term as any).args?.[1];

    if (subject) neighbors.push(subject);
    if (predicate) neighbors.push(predicate);

    return neighbors;
  }

  private detectInefficientChains(): InferenceChain[] {
    const inefficient: InferenceChain[] = [];

    const monitorState = this.monitor.getMonitorState();
    if (monitorState?.reasoningTrace) {
      for (const entry of monitorState.reasoningTrace.slice(-100)) {
        if (entry.duration > 1000) {
          inefficient.push({
            startTerm: entry.startTerm || 'unknown',
            endTerm: entry.endTerm || 'unknown',
            length: 1,
            success: entry.success ?? false,
            duration: entry.duration
          });
        }
      }
    }

    return inefficient;
  }

  private identifySuccessfulStrategies(): string[] {
    const strategies: string[] = [];

    if (this.metrics) {
      const ruleStats = this.metrics.getRuleStats() as any[];
      if (ruleStats) {
        const successful = ruleStats.filter(s => s.successes > 0 && s.executions > 0);
        successful.sort((a, b) => (b.successes / b.executions) - (a.successes / a.executions));
        strategies.push(...successful.slice(0, 5).map(s => s.id));
      }
    }

    return strategies;
  }

  private analyzePerformancePatterns(metricsSummary: any): any {
    const avgRuleExecutionTime = this.calculateAverageRuleExecutionTime();
    const avgMemoryUsage = this.calculateAverageMemoryUsage();
    const throughputTrend = this.determineThroughputTrend();

    return {
      avgRuleExecutionTime,
      avgMemoryUsage,
      throughputTrend
    };
  }

  private analyzeResourceUsage(concepts: any[], stats: any): any {
    const conceptCount = concepts.length;
    const priorities = concepts.map(c => c.priority);
    const avgPriority = priorities.reduce((a, b) => a + b, 0) / (priorities.length || 1);

    return {
      conceptCount,
      memoryUsage: process.memoryUsage ? process.memoryUsage() : {} as NodeJS.MemoryUsage,
      avgConceptPriority: avgPriority,
      highPriorityConcepts: concepts.filter(c => c.priority > 0.7).length,
      lowPriorityConcepts: concepts.filter(c => c.priority < 0.3).length
    };
  }

  private analyzeTaskPatterns(): any {
    return {
      avgProcessingTime: 0,
      queueDepth: 0,
      dropRate: 0
    };
  }

  private async identifyOptimizations(patterns: PatternAnalysis): Promise<Optimizations> {
    const optimizations: Optimizations = {
      rulePriorities: [],
      strategyAdjustments: [],
      resourceAllocations: [],
      performanceImprovements: []
    };

    if (patterns.resourceUsage.conceptCount > 80) {
      optimizations.performanceImprovements.push({
        type: 'memory_cleanup',
        impact: 'high',
        action: 'trigger_consolidation',
        reason: `Concept count (${patterns.resourceUsage.conceptCount}) exceeds threshold (80)`
      });
    }

    if (patterns.resourceUsage.lowPriorityConcepts > patterns.resourceUsage.highPriorityConcepts * 2) {
      optimizations.performanceImprovements.push({
        type: 'priority_rebalancing',
        impact: 'medium',
        action: 'adjust_priorities',
        reason: 'Too many low-priority concepts relative to high-priority'
      });
    }

    if (patterns.performancePatterns.avgRuleExecutionTime > 50) {
      optimizations.performanceImprovements.push({
        type: 'rule_optimization',
        impact: 'medium',
        action: 'optimize_slow_rules',
        reason: `Average rule execution time (${patterns.performancePatterns.avgRuleExecutionTime}ms) is high`
      });
    }

    return optimizations;
  }

  private async applyOptimizations(optimizations: Optimizations): Promise<void> {
    for (const improvement of optimizations.performanceImprovements) {
      switch (improvement.type) {
        case 'memory_cleanup':
          await this.performMemoryCleanup();
          break;
        case 'performance_optimization':
          await this.applyPerformanceOptimizations();
          break;
        case 'priority_rebalancing':
          await this.rebalancePriorities();
          break;
      }
    }
  }

  private async performMemoryCleanup(): Promise<void> {
    if (this.nar?.memory && 'consolidate' in this.nar.memory) {
      (this.nar.memory as any).consolidate?.();
    }
  }

  private async applyPerformanceOptimizations(): Promise<void> {
  }

  private async rebalancePriorities(): Promise<void> {
    if (!this.nar) return;

    const concepts = this.nar.listConcepts();
    for (const concept of concepts) {
      if (concept.priority < 0.1 && concept.totalTasks === 0) {
        concept.priority = Math.min(concept.priority + 0.05, 0.15);
      }
    }
  }

  private async identifyIssues(): Promise<any> {
    return {
      contradictions: [],
      inefficiencies: [],
      resourceIssues: [],
      performanceIssues: []
    };
  }

  private async applyCorrections(issues: any): Promise<any> {
    return { appliedCorrections: [], pendingCorrections: [] };
  }

  private trackOptimization(optimizations: Optimizations): void {
    this.optimizationHistory.performanceImprovements.push(...optimizations.performanceImprovements);
    this.optimizationHistory.performanceImprovements =
      this.optimizationHistory.performanceImprovements.slice(-100);
  }

  private emptyPatternAnalysis(): PatternAnalysis {
    return {
      frequentPatterns: [],
      inefficientChains: [],
      successfulStrategies: [],
      performancePatterns: {
        avgRuleExecutionTime: 0,
        avgMemoryUsage: 0,
        throughputTrend: 'stable'
      },
      resourceUsage: {
        conceptCount: 0,
        memoryUsage: process.memoryUsage ? process.memoryUsage() : {} as NodeJS.MemoryUsage,
        avgConceptPriority: 0,
        highPriorityConcepts: 0,
        lowPriorityConcepts: 0
      },
      taskProcessingPatterns: {
        avgProcessingTime: 0,
        queueDepth: 0,
        dropRate: 0
      }
    };
  }

  private calculateAverageRuleExecutionTime(): number {
    if (!this.metrics) return 0;
    const ruleStats = this.metrics.getRuleStats() as any[];
    if (!ruleStats || ruleStats.length === 0) return 0;

    const total = ruleStats.reduce((sum, s) => sum + s.averageDuration, 0);
    return total / ruleStats.length;
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

    const recent = Array.from(this.patternHistory.values()).slice(-5);
    if (recent.length < 2) return 'stable';

    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const trend = recent[recent.length - 1] > avg * 1.1 ? 'increasing' :
                  recent[recent.length - 1] < avg * 0.9 ? 'decreasing' : 'stable';

    return trend;
  }

  private getPerformanceAnalysis(): any {
    return {
      ruleExecution: this.calculateAverageRuleExecutionTime(),
      memoryUsage: this.calculateAverageMemoryUsage(),
      throughput: this.determineThroughputTrend()
    };
  }

  private getResourceAnalysis(): any {
    if (!this.nar) return {};

    const concepts = this.nar.listConcepts();
    return {
      conceptCount: concepts.length,
      avgPriority: concepts.reduce((sum, c) => sum + c.priority, 0) / (concepts.length || 1),
      memoryUsage: process.memoryUsage ? process.memoryUsage() : {}
    };
  }
}
