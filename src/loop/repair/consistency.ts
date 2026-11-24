/**
 * Consistency Repair — repairs for consistency and gate anomalies.
 */

import type { RepairContext, RepairAction, Anomaly, RepairPolicy } from './types';

/** Generate consistency repair actions. */
export function generateConsistencyRepairs(context: RepairContext, anomaly: Anomaly): RepairAction[] {
  const actions: RepairAction[] = [];

  // Retry the failed operation
  actions.push({
    type: 'retry',
    description: 'Retry the failed gate or contract check',
    params: { gateName: anomaly.description },
    confidence: 0.7,
    cost: 5,
  });

  // Replan with different approach
  actions.push({
    type: 'replan',
    description: 'Replan the current goal with alternative strategies',
    params: { avoidGate: anomaly.description },
    confidence: 0.6,
    cost: 15,
  });

  // Escalate to higher-level repair
  actions.push({
    type: 'escalate',
    description: 'Escalate to meta-cognitive repair',
    params: { anomalyId: anomaly.id },
    confidence: 0.5,
    cost: 25,
  });

  return actions;
}

/** Gate failure repair policy. */
export const gateFailureRepairPolicy: RepairPolicy = {
  name: 'gate-failure',
  appliesTo: ['gate_failure', 'contract_violation'],
  minSeverity: 'medium',
  generateActions: generateConsistencyRepairs,
  priority: 70,
};

/** Oracle failure repair policy. */
export const oracleFailureRepairPolicy: RepairPolicy = {
  name: 'oracle-failure',
  appliesTo: ['oracle_failure'],
  minSeverity: 'high',
  generateActions: (context: RepairContext, anomaly: Anomaly): RepairAction[] => [
    {
      type: 'fallback',
      description: 'Use fallback for failed oracle operation',
      params: { operation: anomaly.description },
      confidence: 0.8,
      cost: 10,
    },
    {
      type: 'delegate',
      description: 'Delegate oracle call to alternative provider',
      params: { operation: anomaly.description },
      confidence: 0.6,
      cost: 20,
    },
  ],
  priority: 85,
};