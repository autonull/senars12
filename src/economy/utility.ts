/**
 * Utility — utility calculation for the task economy.
 *
 * U = Σ wᵢ·φᵢ and EU(task) = E[U(s′) − U(s)] − λ·cost − ρ·risk
 * are the only utility arithmetic.
 */

import type { EconomyTask, TaskUtility, TaskVoI, Successor, Overlay, SchedulerConfig } from './types';
import type { Truth } from '../kernel/truth';
import type { Clock } from '../kernel/env';
import { createDefaultClock } from '../kernel/env';

/** Utility weights for different task kinds. */
export const KIND_UTILITY_WEIGHTS: Record<string, number> = {
  belief: 1.0,
  goal: 2.0,
  skill: 1.5,
  faculty: 1.2,
  rule: 0.8,
  plan: 1.3,
};

/** Cost weights. */
export const COST_WEIGHTS = {
  oracleCall: 0.1,
  facultyCall: 0.05,
  derivation: 0.02,
  memoryAccess: 0.01,
  cpuTime: 0.001,
} as const;

/** Risk weights. */
export const RISK_WEIGHTS = {
  uncertainty: 0.5,
  contradiction: 1.0,
  timeout: 0.3,
  sideEffect: 0.7,
} as const;

/**
 * Calculate base utility: U = Σ wᵢ·φᵢ
 * where wᵢ is the task weight and φᵢ is the feature value (truth confidence).
 */
export function calculateBaseUtility(task: EconomyTask, overlays: Overlay[] = []): number {
  const kindWeight = KIND_UTILITY_WEIGHTS[task.kind] ?? 1.0;
  const truthWeight = task.truth.c; // confidence as feature value

  // Apply overlay modifiers
  let overlayMultiplier = 1.0;
  for (const overlay of overlays) {
    if (!overlay.active) continue;
    overlayMultiplier *= overlay.kindWeights[task.kind] ?? 1.0;
    overlayMultiplier *= overlay.sourceWeights[task.source] ?? 1.0;
    for (const tag of task.tags) {
      if (overlay.tagWeights[tag]) {
        overlayMultiplier *= overlay.tagWeights[tag];
      }
    }
  }

  return task.weight * kindWeight * truthWeight * overlayMultiplier;
}

/**
 * Calculate expected utility gain: E[U(s') - U(s)]
 * Estimates utility change from executing this task.
 */
export function calculateExpectedGain(
  task: EconomyTask,
  successors: Successor[],
  currentTotalUtility: number
): number {
  if (successors.length === 0) return 0;

  let expectedGain = 0;
  for (const succ of successors) {
    expectedGain += succ.probability * succ.utilityDelta;
  }

  return expectedGain;
}

/**
 * Calculate cost estimate: λ·cost
 */
export function calculateCost(task: EconomyTask, config: SchedulerConfig): number {
  let cost = 0;

  // Base cost from task kind
  const kindCost: Record<string, number> = {
    belief: 1,
    goal: 2,
    skill: 3,
    faculty: 2,
    rule: 1,
    plan: 4,
  };
  cost += kindCost[task.kind] ?? 1;

  // Add cost from dependencies
  cost += task.dependencies.length * 0.5;

  // Add cost from derived tasks (more complex)
  if (task.derived) cost += 1;

  // Scale by budget
  return cost * (config.budgetPerIteration / 100);
}

/**
 * Calculate risk estimate: ρ·risk
 */
export function calculateRisk(task: EconomyTask, clock?: Clock): number {
  let risk = 0;

  // Uncertainty risk (inverse of confidence)
  risk += (1 - task.truth.c) * RISK_WEIGHTS.uncertainty;

  // Low frequency/activation risk
  if (task.activation < 0.1) risk += 0.2;

  // Age risk
  const age = (clock ?? createDefaultClock()).now() - task.createdAt;
  const ageHours = age / (1000 * 60 * 60);
  if (ageHours > 24) risk += Math.min(1, ageHours / 168) * 0.5; // Up to 0.5 after a week

  return risk;
}

/**
 * Calculate full task utility: EU = base + expectedGain - cost - risk
 */
export function calculateTaskUtility(
  task: EconomyTask,
  successors: Successor[],
  currentTotalUtility: number,
  config: SchedulerConfig,
  overlays: Overlay[] = []
): TaskUtility {
  const base = calculateBaseUtility(task, overlays);
  const expectedGain = calculateExpectedGain(task, successors, currentTotalUtility);
  const cost = calculateCost(task, config);
  const risk = calculateRisk(task);
  const total = base + expectedGain - cost - risk;

  return { base, expectedGain, cost, risk, total };
}

/**
 * Calculate Value of Information for a task.
 */
export function calculateVoI(
  task: EconomyTask,
  goals: EconomyTask[],
  beliefs: EconomyTask[]
): TaskVoI {
  // Uncertainty reduction: how much this task reduces uncertainty about goals
  let uncertaintyReduction = 0;
  for (const goal of goals) {
    const alignment = computeTaskAlignment(task, goal);
    uncertaintyReduction += alignment * (1 - goal.truth.c);
  }
  uncertaintyReduction /= Math.max(1, goals.length);

  // Goal alignment
  let goalAlignment = 0;
  for (const goal of goals) {
    goalAlignment += computeTaskAlignment(task, goal);
  }
  goalAlignment /= Math.max(1, goals.length);

  // Belief relevance
  let beliefRelevance = 0;
  for (const belief of beliefs) {
    beliefRelevance += computeTaskRelevance(task, belief);
  }
  beliefRelevance /= Math.max(1, beliefs.length);

  const value = (uncertaintyReduction + goalAlignment + beliefRelevance) / 3;

  return { value, uncertaintyReduction, goalAlignment, beliefRelevance };
}

/** Compute alignment between two tasks based on term similarity. */
function computeTaskAlignment(a: EconomyTask, b: EconomyTask): number {
  const aStr = a.term.toString();
  const bStr = b.term.toString();

  if (aStr === bStr) return 1.0;
  if (aStr.includes(bStr) || bStr.includes(aStr)) return 0.8;

  // Jaccard similarity on tokens
  const aTokens = new Set(aStr.split(/[\s\(\)\[\],]+/));
  const bTokens = new Set(bStr.split(/[\s\(\)\[\],]+/));
  const intersection = new Set([...aTokens].filter(x => bTokens.has(x)));
  const union = new Set([...aTokens, ...bTokens]);
  return intersection.size / union.size;
}

/** Compute relevance of task to belief. */
function computeTaskRelevance(task: EconomyTask, belief: EconomyTask): number {
  return computeTaskAlignment(task, belief);
}

/**
 * Calculate total economy utility: U = Σ wᵢ·φᵢ across all tasks.
 */
export function calculateTotalUtility(tasks: EconomyTask[], overlays: Overlay[] = []): number {
  let total = 0;
  for (const task of tasks) {
    total += calculateBaseUtility(task, overlays);
  }
  return total;
}

/**
 * Rank tasks by utility.
 */
export function rankTasksByUtility(
  tasks: EconomyTask[],
  successors: Map<string, Successor[]>,
  currentTotalUtility: number,
  config: SchedulerConfig,
  overlays: Overlay[] = []
): Array<{ task: EconomyTask; utility: TaskUtility }> {
  const ranked: Array<{ task: EconomyTask; utility: TaskUtility }> = [];

  for (const task of tasks) {
    const taskSuccessors = successors.get(task.id) ?? [];
    const utility = calculateTaskUtility(task, taskSuccessors, currentTotalUtility, config, overlays);
    ranked.push({ task, utility });
  }

  ranked.sort((a, b) => b.utility.total - a.utility.total);
  return ranked;
}