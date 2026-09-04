import { createLogger } from '../logger/index.js';
import type { MetricsCollector, NAR } from '../nar.js';
import { SelfOptimizer } from '../self/SelfOptimizer';
import { errMsg } from '../utils';
import type { MetacognitiveMonitor } from './MetacognitiveMonitor.js';

export type { MetaCognitiveResult, MonitorState } from './types.js';

import { diffCapabilities, getCapabilitySnapshot } from './analyzers/capabilities.js';
import { applyCorrections, identifyIssues } from './analyzers/corrections.js';
import { createPolicyManager } from './analyzers/policy.js';
import { assessQuality } from './analyzers/quality.js';
import { analyzeReasoningPatterns } from './analyzers/reasoning-patterns.js';

import { getResourceAnalysis } from './analyzers/resources.js';
import type {
  AgentPolicy,
  CapabilityDiff,
  CapabilitySnapshot,
  CorrectionResult,
  IdentifiedIssues,
  MetaCognitiveResult,
  MonitorState,
  PatternAnalysis,
  PerformancePatterns,
  QualityAssessment,
  ResourceUsage,
  SelfAnalyzerConfig,
} from './types.js';

const log = createLogger({ scope: 'self-analyzer' });

export class SelfAnalyzerService {
  private readonly nar: NAR | null;
  private readonly monitor: MetacognitiveMonitor;
  private readonly metrics: MetricsCollector | null;
  private readonly optimizer: SelfOptimizer;
  private readonly config: Required<SelfAnalyzerConfig>;
  private readonly policyManager: ReturnType<typeof createPolicyManager>;

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
    this.policyManager = createPolicyManager(this.config.recencyEpisodes);
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
        error: errMsg(error),
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
        error: errMsg(error),
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
      performance: this.analyzePerformancePatterns(),
      resourceUsage: getResourceAnalysis(this.nar, this.metrics),
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
        log.warn('applyOptimizations failed', e as Error);
      });
  }

  recordRoute(kind: string): void {
    this.policyManager.recordRoute(kind);
  }

  recordTool(name: string): void {
    this.policyManager.recordTool(name);
  }

  recomputePolicy(): AgentPolicy {
    return this.policyManager.recomputePolicy(this.metrics);
  }

  getPolicy(): AgentPolicy {
    return this.policyManager.getPolicy();
  }

  async assessQuality(): Promise<QualityAssessment> {
    return assessQuality(this.nar);
  }

  async getCapabilitySnapshot(): Promise<CapabilitySnapshot> {
    return getCapabilitySnapshot(this.nar);
  }

  diffCapabilities(before: CapabilitySnapshot, after: CapabilitySnapshot): CapabilityDiff {
    return diffCapabilities(before, after);
  }

  private async analyzeReasoningPatterns(): Promise<PatternAnalysis> {
    return analyzeReasoningPatterns(this.nar, this.monitor, this.metrics);
  }

  private analyzePerformancePatterns(): PerformancePatterns {
    const ruleStats = this.metrics?.getRuleStats();
    const avgDuration = Array.isArray(ruleStats)
      ? ruleStats.reduce((a, b) => a + b.averageDuration, 0) / ruleStats.length
      : 0;
    return {
      ruleExecution: avgDuration,
      memoryUsage: 0,
      throughput: 'stable' as const,
    };
  }

  private async identifyIssues(): Promise<IdentifiedIssues> {
    return identifyIssues(this.nar, this.monitor, this.metrics);
  }

  private async applyCorrections(issues: IdentifiedIssues): Promise<CorrectionResult> {
    return applyCorrections(this.nar, issues, this.optimizer);
  }
}
