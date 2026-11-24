/**
 * Aging — task aging and decay policies for the economy.
 *
 * Manages activation decay, access-based boosting, and stale task removal.
 */

import type { EconomyTask, AgingPolicy, EconomyTaskBagKind } from './types';
import type { Histogram } from '@senars/util/bag';
import type { Clock, TimestampMs } from '../kernel/env';
import { createDefaultClock } from '../kernel/env';

const nowOf = (clock?: Clock): TimestampMs => (clock ?? createDefaultClock()).now();

/** Aging statistics. */
export interface AgingStats {
  /** Tasks aged this cycle. */
  tasksAged: number;
  /** Tasks boosted by access. */
  tasksBoosted: number;
  /** Tasks removed (stale). */
  tasksRemoved: number;
  /** Tasks at minimum activation. */
  atMinActivation: number;
  /** Average activation. */
  avgActivation: number;
  /** Adaptive activation histogram (replaces fixed buckets). */
  activationHistogram: Histogram;
}

/** Default aging policy. */
export const defaultAgingPolicy: AgingPolicy = {
  decayRate: 0.995,
  minActivation: 0.01,
  accessBoost: 0.1,
  maxAge: 10000, // hours
};

/** Kind-specific aging modifiers. */
export const KIND_AGING_MODIFIERS: Record<EconomyTaskBagKind, { decayMult: number; boostMult: number; maxAgeMult: number }> = {
  belief: { decayMult: 1.0, boostMult: 1.0, maxAgeMult: 1.0 },
  goal: { decayMult: 0.8, boostMult: 1.5, maxAgeMult: 2.0 }, // Goals persist longer
  skill: { decayMult: 0.5, boostMult: 2.0, maxAgeMult: 5.0 }, // Skills decay slowly
  faculty: { decayMult: 0.7, boostMult: 1.2, maxAgeMult: 3.0 },
  rule: { decayMult: 0.3, boostMult: 1.0, maxAgeMult: 10.0 }, // Rules are stable
  plan: { decayMult: 1.2, boostMult: 1.0, maxAgeMult: 0.5 }, // Plans age quickly
};

/**
 * Apply aging to all tasks.
 */
export function applyAging(
  tasks: Map<string, EconomyTask>,
  policy: AgingPolicy = defaultAgingPolicy,
  currentIteration: number,
  clock?: Clock
): AgingStats {
  const now = nowOf(clock);
  const toRemove: string[] = [];
  let activationSum = 0;
  let tasksAged = 0;
  let tasksBoosted = 0;
  let atMinActivation = 0;

  for (const [id, task] of tasks) {
    tasksAged++;

    // Get kind-specific modifiers
    const modifier = KIND_AGING_MODIFIERS[task.kind] ?? { decayMult: 1, boostMult: 1, maxAgeMult: 1 };

    // Decay activation
    const effectiveDecay = policy.decayRate * modifier.decayMult;
    task.activation *= effectiveDecay;

    // Boost from recent access
    const iterationsSinceAccess = currentIteration - (task.lastAccessed > 0 ? Math.floor(task.lastAccessed / 1000) : currentIteration);
    if (iterationsSinceAccess < 10) {
      const boost = policy.accessBoost * modifier.boostMult * (1 - iterationsSinceAccess / 10);
      task.activation = Math.min(1, task.activation + boost);
      tasksBoosted++;
    }

    // Enforce minimum
    if (task.activation < policy.minActivation) {
      task.activation = policy.minActivation;
      atMinActivation++;
    }

    activationSum += task.activation;

    // Check max age
    const ageHours = (now - task.createdAt) / (1000 * 60 * 60);
    const effectiveMaxAge = policy.maxAge * modifier.maxAgeMult;
    if (ageHours > effectiveMaxAge) {
      toRemove.push(id);
    }
  }

  // Remove stale tasks
  for (const id of toRemove) {
    tasks.delete(id);
  }

  const tasksRemoved = toRemove.length;
  const avgActivation = tasksAged > 0 ? activationSum / tasksAged : 0;

  // Compute adaptive histogram from current activations
  // Using a temporary bag-like structure for histogram computation
  const activationValues = [...tasks.values()].map(t => t.activation);
  const activationHistogram = computeHistogram(activationValues, 10);

  return {
    tasksAged,
    tasksBoosted,
    tasksRemoved,
    atMinActivation,
    avgActivation,
    activationHistogram,
  };
}

/** Compute adaptive histogram from array of values. */
function computeHistogram(values: number[], bins: number): Histogram {
  if (values.length === 0) {
    return { edges: [0, 1], counts: [0], total: 0, min: 0, max: 0, mean: 0 };
  }

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;

  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }

  const mean = sum / values.length;

  if (min === max) {
    return { edges: [min, max + 1], counts: [values.length], total: values.length, min, max, mean };
  }

  const actualBins = Math.min(bins, values.length);
  const edges = new Array<number>(actualBins + 1);
  const width = (max - min) / actualBins;

  for (let i = 0; i <= actualBins; i++) {
    edges[i] = min + i * width;
  }
  edges[actualBins] = max;

  const counts = new Array<number>(actualBins).fill(0);
  for (const v of values) {
    if (v === max) {
      counts[actualBins - 1]!++;
    } else {
      const idx = Math.floor((v - min) / width);
      counts[Math.min(idx, actualBins - 1)]!++;
    }
  }

  return { edges, counts, total: values.length, min, max, mean };
}

/**
 * Calculate task priority with aging considered.
 */
export function calculateAgedPriority(task: EconomyTask, policy: AgingPolicy = defaultAgingPolicy, clock?: Clock): number {
  const modifier = KIND_AGING_MODIFIERS[task.kind] ?? { decayMult: 1, boostMult: 1, maxAgeMult: 1 };

  // Base priority from weight and activation
  let priority = task.weight * task.activation;

  // Age bonus for old but still relevant tasks
  const ageHours = (nowOf(clock) - task.createdAt) / (1000 * 60 * 60);
  if (ageHours > 24 && task.activation > policy.minActivation * 2) {
    priority *= 1 + Math.min(0.5, ageHours / 1000); // Up to 50% bonus
  }

  // Access frequency bonus
  if (task.accessCount > 10) {
    priority *= 1 + Math.min(0.3, task.accessCount / 100);
  }

  return priority;
}

/**
 * Get aging policy for a specific task kind.
 */
export function getAgingPolicyForKind(kind: EconomyTaskBagKind, basePolicy: AgingPolicy = defaultAgingPolicy): AgingPolicy {
  const modifier = KIND_AGING_MODIFIERS[kind] ?? { decayMult: 1, boostMult: 1, maxAgeMult: 1 };
  return {
    decayRate: basePolicy.decayRate * modifier.decayMult,
    minActivation: basePolicy.minActivation,
    accessBoost: basePolicy.accessBoost * modifier.boostMult,
    maxAge: basePolicy.maxAge * modifier.maxAgeMult,
  };
}

/**
 * Check if a task is stale (should be considered for removal).
 */
export function isStale(task: EconomyTask, policy: AgingPolicy = defaultAgingPolicy, clock?: Clock): boolean {
  const modifier = KIND_AGING_MODIFIERS[task.kind] ?? { decayMult: 1, boostMult: 1, maxAgeMult: 1 };
  const effectiveMaxAge = policy.maxAge * modifier.maxAgeMult;
  const ageHours = (nowOf(clock) - task.createdAt) / (1000 * 60 * 60);

  return ageHours > effectiveMaxAge && task.activation <= policy.minActivation * 1.5;
}

/**
 * Get tasks that should be reviewed (old but potentially valuable).
 */
export function getTasksForReview(
  tasks: EconomyTask[],
  policy: AgingPolicy = defaultAgingPolicy,
  maxAgeHours = 168, // 1 week
  clock?: Clock
): EconomyTask[] {
  const now = nowOf(clock);
  return tasks.filter(task => {
    const ageHours = (now - task.createdAt) / (1000 * 60 * 60);
    return ageHours > maxAgeHours && task.activation > policy.minActivation * 2;
  });
}