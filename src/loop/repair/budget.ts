/**
 * Budget Repair — repairs for resource exhaustion and budget anomalies.
 */

import type { RepairContext, RepairAction, Anomaly, RepairPolicy } from './types';

/** Generate budget repair actions. */
export function generateBudgetRepairs(context: RepairContext, anomaly: Anomaly): RepairAction[] {
  const actions: RepairAction[] = [];

  // Reduce scope to fit budget
  actions.push({
    type: 'reduce_scope',
    description: 'Reduce goal scope to fit within token budget',
    params: { currentUsage: context.resources.tokensUsed, budget: context.resources.tokensRemaining },
    confidence: 0.9,
    cost: 5,
  });

  // Increase budget if possible
  actions.push({
    type: 'increase_budget',
    description: 'Request additional token budget for current iteration',
    params: { requested: context.resources.tokensUsed * 0.2 },
    confidence: 0.5,
    cost: 0,
  });

  // Delegate to sub-economy
  actions.push({
    type: 'delegate',
    description: 'Delegate expensive sub-goals to sub-economy',
    params: { parentGoal: context.goals[0]?.id },
    confidence: 0.6,
    cost: 15,
  });

  // Abort if critical
  if (anomaly.severity === 'critical') {
    actions.push({
      type: 'abort',
      description: 'Abort current iteration due to resource exhaustion',
      params: { reason: 'resource_exhaustion' },
      confidence: 0.95,
      cost: 0,
    });
  }

  return actions;
}

/** Resource exhaustion repair policy. */
export const resourceExhaustionRepairPolicy: RepairPolicy = {
  name: 'resource-exhaustion',
  appliesTo: ['resource_exhaustion'],
  minSeverity: 'medium',
  generateActions: generateBudgetRepairs,
  priority: 95,
};

/** Stall repair policy. */
export const stallRepairPolicy: RepairPolicy = {
  name: 'stall',
  appliesTo: ['stall'],
  minSeverity: 'medium',
  generateActions: (context: RepairContext, anomaly: Anomaly): RepairAction[] => [
    {
      type: 'retry',
      description: 'Retry stalled operation with increased timeout',
      params: { timeoutMultiplier: 2 },
      confidence: 0.6,
      cost: 10,
    },
    {
      type: 'replan',
      description: 'Replan around stalled dependency',
      params: { stalledGoal: anomaly.description },
      confidence: 0.7,
      cost: 15,
    },
    {
      type: 'delegate',
      description: 'Delegate stalled goal to alternative process',
      params: { goal: anomaly.description },
      confidence: 0.5,
      cost: 20,
    },
  ],
  priority: 75,
};

/** Divergence repair policy. */
export const divergenceRepairPolicy: RepairPolicy = {
  name: 'divergence',
  appliesTo: ['divergence'],
  minSeverity: 'high',
  generateActions: (context: RepairContext, anomaly: Anomaly): RepairAction[] => [
    {
      type: 'verify_premises',
      description: 'Verify premises causing divergence',
      params: { divergenceId: anomaly.id },
      confidence: 0.8,
      cost: 10,
    },
    {
      type: 'reduce_scope',
      description: 'Reduce derivation scope to prevent divergence',
      params: { maxDepth: 5 },
      confidence: 0.7,
      cost: 5,
    },
    {
      type: 'abort',
      description: 'Abort divergent derivation chain',
      params: { reason: 'divergence' },
      confidence: 0.9,
      cost: 0,
    },
  ],
  priority: 80,
};