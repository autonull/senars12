/**
 * Issue identification and corrections - extracted from SelfAnalyzerService
 */
import type { MetricsCollector, NAR } from '../../nar.js';
import type { MetacognitiveMonitor } from '../MetacognitiveMonitor.js';
import type { CorrectionResult, IdentifiedIssues } from '../types.js';
import { analyzeTaskPatterns } from './performance.js';
import { detectInefficientChains } from './reasoning-patterns.js';

export const identifyIssues = async (
  nar: NAR | null,
  monitor: MetacognitiveMonitor,
  metrics: MetricsCollector | null
): Promise<IdentifiedIssues> => {
  const issues: IdentifiedIssues = {
    contradictions: [],
    inefficiencies: [],
    resourceIssues: [],
    performanceIssues: [],
  };
  if (!nar) return issues;

  const concepts = nar.listConcepts();
  const lowPriorityRatio = concepts.filter((c) => c.priority < 0.2).length / (concepts.length || 1);

  if (lowPriorityRatio > 0.5) {
    issues.resourceIssues.push({
      type: 'high_low_priority_ratio',
      severity: 'medium',
      value: lowPriorityRatio,
      description: 'Over 50% of concepts have low priority',
    });
  }

  if (concepts.length > 100) {
    issues.resourceIssues.push({
      type: 'high_concept_count',
      severity: 'high',
      value: concepts.length,
      description: 'Concept count exceeds recommended limit',
    });
  }

  const inefficientChains = detectInefficientChains(monitor);
  if (inefficientChains.length > 0) {
    issues.inefficiencies.push(
      ...inefficientChains.map((chain) => ({
        type: 'slow_inference_chain',
        severity: 'medium',
        description: `Inference chain from ${chain.startTerm} to ${chain.endTerm} took ${chain.duration}ms`,
        ...chain,
      }))
    );
  }

  if (monitor.getMonitorState().performance === 'declining') {
    issues.performanceIssues.push({
      type: 'declining_performance',
      severity: 'high',
      description: 'System performance is declining over time',
    });
  }

  const taskPatterns = analyzeTaskPatterns(nar, metrics);
  if (taskPatterns.dropRate > 0.1) {
    issues.performanceIssues.push({
      type: 'high_task_drop_rate',
      severity: 'high',
      value: taskPatterns.dropRate,
      description: 'More than 10% of tasks are being dropped',
    });
  }

  return issues;
};

export const applyCorrections = async (
  nar: NAR | null,
  issues: IdentifiedIssues,
  optimizer: {
    rebalancePriorities: () => Promise<void>;
    applyPerformanceOptimizations: () => Promise<void>;
  }
): Promise<CorrectionResult> => {
  const appliedCorrections: { type: string; issue: string }[] = [];
  const pendingCorrections: { type: string; issue: string; reason: string }[] = [];

  if (!nar) return { appliedCorrections, pendingCorrections };

  for (const issue of issues.resourceIssues || []) {
    if (issue.type === 'high_low_priority_ratio') {
      await optimizer.rebalancePriorities();
      appliedCorrections.push({ type: 'priority_rebalancing', issue: 'high_low_priority_ratio' });
    } else if (issue.type === 'high_concept_count') {
      if (nar.memory) {
        nar.memory.consolidate();
        appliedCorrections.push({ type: 'memory_consolidation', issue: 'high_concept_count' });
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
      await optimizer.applyPerformanceOptimizations();
      appliedCorrections.push({ type: 'performance_optimization', issue: 'declining_performance' });
    } else if (issue.type === 'high_task_drop_rate') {
      const config = nar.getConfig?.() || {};
      nar.setConfig?.({
        ...config,
        maxDerivationsPerStep: Math.max(50, (config.maxDerivationsPerStep || 100) - 20),
      });
      appliedCorrections.push({ type: 'throttle_reduction', issue: 'high_task_drop_rate' });
    }
  }

  for (const issue of issues.inefficiencies || []) {
    if (issue.type === 'slow_inference_chain') {
      pendingCorrections.push({
        type: 'chain_optimization',
        issue: 'slow_inference_chain',
        reason: 'Requires manual review',
      });
    }
  }

  return { appliedCorrections, pendingCorrections };
};
