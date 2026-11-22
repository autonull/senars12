import { createLogger } from '@senars/util/logger';
import { errMsg } from '@senars/util/error';
import type { ModelRuleStats } from '../../lm';
import type { SelfHost } from '../../self/host';
import { SelfOptimizer } from '../../self/SelfOptimizer';
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
} from '../types';
import { diffCapabilities, getCapabilitySnapshot } from './analyzers/capabilities';
import { applyCorrections, identifyIssues } from './analyzers/corrections';
import { analyzePerformancePatterns } from './analyzers/performance';
import { createPolicyManager } from './analyzers/policy';
import { assessQuality } from './analyzers/quality';
import { analyzeReasoningPatterns } from './analyzers/reasoning-patterns';
import { getResourceAnalysis } from './analyzers/resources';
import type { MetacognitiveMonitor } from './MetacognitiveMonitor';

export type { MetaCognitiveResult, MonitorState } from '../types';

const log = createLogger({ scope: 'self-analyzer' });

export class SelfAnalyzerService {
  private readonly nar: SelfHost | null;
  private readonly monitor: MetacognitiveMonitor;
  private readonly ruleStats: readonly ModelRuleStats[] | null;
  private readonly optimizer: SelfOptimizer;
  private readonly config: Required<SelfAnalyzerConfig>;
  private readonly policyManager: ReturnType<typeof createPolicyManager>;

  constructor(
    nar: SelfHost | null,
    monitor: MetacognitiveMonitor,
    ruleStats: readonly ModelRuleStats[] | null,
    config: SelfAnalyzerConfig = {}
  ) {
    this.nar = nar;
    this.monitor = monitor;
    this.ruleStats = ruleStats;
    this.optimizer = new SelfOptimizer(nar);
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
      resourceUsage: getResourceAnalysis(this.nar),
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
        log.warn('applyOptimizations failed', { error: errMsg(e) });
      });
  }

  recordRoute(kind: string): void {
    this.policyManager.recordRoute(kind);
  }

  recordTool(name: string): void {
    this.policyManager.recordTool(name);
  }

  recomputePolicy(): AgentPolicy {
    return this.policyManager.recomputePolicy(this.ruleStats);
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
    return analyzeReasoningPatterns(this.nar, this.monitor, this.ruleStats);
  }

  private analyzePerformancePatterns(): PerformancePatterns {
    return analyzePerformancePatterns(this.ruleStats);
  }

  private async identifyIssues(): Promise<IdentifiedIssues> {
    return identifyIssues(this.nar, this.monitor);
  }

  private async applyCorrections(issues: IdentifiedIssues): Promise<CorrectionResult> {
    return applyCorrections(this.nar, issues, this.optimizer);
  }
}
