/**
 * Self-analyzer types - extracted from SelfAnalyzerService
 */

import type { ReasoningStep } from './MetacognitiveMonitor.js';

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

export type { ReasoningStep };

export interface MetaCognitiveResult {
  success: boolean;
  patterns?: PatternAnalysis;
  optimizations?: import('../self/SelfOptimizer').Optimizations;
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

export interface PerformancePatterns {
  ruleExecution: number;
  memoryUsage: number;
  throughput: 'increasing' | 'decreasing' | 'stable';
}

export interface ResourceUsage {
  conceptCount: number;
  memoryUsage: NodeJS.MemoryUsage;
  avgConceptPriority: number;
  highPriorityConcepts: number;
  lowPriorityConcepts: number;
}

export interface TaskPatterns {
  avgProcessingTime: number;
  queueDepth: number;
  dropRate: number;
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
  changed: Array<{ name: string; before: string; after: string }>;
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
