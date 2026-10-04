import { incrementCount, safeRatio } from '@senars/util';
import type { TrajectoryStep } from './ReasoningTrajectoryLogger.js';

export interface TrajectoryFeatures {
  toolCalls: TrajectoryStep[];
  lmResponses: TrajectoryStep[];
  errors: TrajectoryStep[];
  uniqueTools: Set<string>;
}

export function extractTrajectoryFeatures(trajectory: TrajectoryStep[]): TrajectoryFeatures {
  const toolCalls: TrajectoryStep[] = [],
    lmResponses: TrajectoryStep[] = [],
    errors: TrajectoryStep[] = [];
  const uniqueTools = new Set<string>();
  for (const s of trajectory) {
    if (s.type === 'tool_call') {
      toolCalls.push(s);
      uniqueTools.add(String((s.data as Record<string, unknown>)?.name || 'unknown'));
    } else if (s.type === 'lm_response') {
      lmResponses.push(s);
    } else if (s.type === 'lm_failure') {
      errors.push(s);
    }
  }
  return { toolCalls, lmResponses, errors, uniqueTools };
}

// Identify common features across multiple trajectories. Returns feature -> normalized frequency.
export function findCommonFeatures(trajectories: TrajectoryStep[][]): Map<string, number> {
  const featureCounts = new Map<string, number>();

  for (const trajectory of trajectories) {
    const features = new Set<string>();

    trajectory.forEach((step) => {
      if (step.type === 'tool_call') {
        const toolName = (step.data as Record<string, unknown>)?.name || 'unknown';
        features.add(`tool:${toolName}`);
      } else if (step.type === 'lm_response') {
        features.add('lm_response');
      }
    });

    for (const feature of features) {
      incrementCount(featureCounts, feature);
    }
  }

  const threshold = Math.max(1, Math.ceil(trajectories.length * 0.6));
  const commonFeatures = new Map<string, number>();

  for (const [feature, count] of featureCounts.entries()) {
    if (count >= threshold) {
      commonFeatures.set(feature, safeRatio(count, trajectories.length));
    }
  }

  return commonFeatures;
}
