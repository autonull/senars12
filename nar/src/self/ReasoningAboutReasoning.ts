import { createLogger, errMsg, periodic, type TermTruth } from '@senars/util';
import { MetacognitiveMonitor, MONITOR_DEFAULTS } from '../cognitive/impls/MetacognitiveMonitor.js';
import {
  type MetaCognitiveResult,
  type MonitorState,
  SelfAnalyzerService as SelfAnalyzer,
} from '../cognitive/impls/SelfAnalyzerService.js';
import type { QualityAssessment } from '../cognitive/types.js';
import type { SelfHost } from '../self/host.js';

export interface GapReport {
  missingRules: string[];
  lowConfidenceBeliefs: Array<{ term: string } & TermTruth>;
  repeatedFailures: string[];
}

const logger = createLogger({ scope: 'ReasoningAboutReasoning' });

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

export class ReasoningAboutReasoning {
  isRunning = false;
  private readonly nar: SelfHost | null;
  private readonly config: Required<ReasoningAboutReasoningConfig>;
  private readonly monitor: MetacognitiveMonitor;
  private analyzer: SelfAnalyzer;
  private stopPeriodicAnalysis: (() => void) | null = null;

  constructor(nar: SelfHost | null, config: ReasoningAboutReasoningConfig = {}) {
    this.nar = nar;
    this.config = {
      ...MONITOR_DEFAULTS,
      ...config,
      monitoringInterval: config.monitoringInterval ?? 1000,
      reasoningInterval: config.reasoningInterval ?? 30000,
      selfCorrectionEnabled: config.selfCorrectionEnabled ?? true,
    };

    this.monitor = new MetacognitiveMonitor(nar, config);
    this.analyzer = new SelfAnalyzer(nar, this.monitor, null, config);
  }

  start(): void {
    this.isRunning = true;
    this.startPeriodicSelfAnalysis();
  }

  stop(): void {
    this.isRunning = false;
    this.stopPeriodicAnalysis?.();
    this.stopPeriodicAnalysis = null;
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
    return { missingRules: [], lowConfidenceBeliefs: [], repeatedFailures: [] };
  }

  querySystemState(): SystemState {
    if (!this.nar) {
      return {
        reasoningTrace: [],
        performanceTrend: 'unknown',
        currentContext: { memorySize: 0, conceptCount: 0, timestamp: Date.now() },
        performanceMonitors: { throughput: 0 },
        activeMetaTasks: 0,
        isRunning: false,
      };
    }

    const memory = this.nar.memory;
    const config = this.nar.getConfig();
    const stats = this.nar.getStatistics();
    const monitorState = this.monitor.getMonitorState();
    const isRunning = this.nar.isRunning();

    return {
      reasoningTrace: this.monitor.getReasoningTrace().slice(-10),
      performanceTrend: this.monitor.getPerformanceTrend(),
      currentContext: {
        memorySize: memory?.size ?? 0,
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
    const isRunning = this.nar?.isRunning() ?? false;

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
    this.stopPeriodicAnalysis?.();
    this.stopPeriodicAnalysis = null;
    this.monitor.shutdown();
    this.analyzer.shutdown();
  }

  private startPeriodicSelfAnalysis(): void {
    this.stopPeriodicAnalysis?.();
    if (this.config.reasoningInterval <= 0) return;
    this.stopPeriodicAnalysis = periodic(async () => {
      try {
        await this.performMetaCognitiveReasoning();
      } catch (error) {
        logger.warn(`Periodic self-analysis error: ${errMsg(error)}`);
      }
    }, this.config.reasoningInterval);
  }
}
