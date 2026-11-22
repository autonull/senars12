/**
 * Drives — drive machinery unified into the gradient view.
 *
 * Drives become a gradient over the task economy: each drive is a
 * weight vector over task kinds/sources that shapes the utility landscape.
 * This replaces the separate drive machinery with a single gradient view.
 */

import type { EconomyTask, TaskBagKind, TaskSource, Overlay, SchedulerConfig } from './types.js';
import type { Truth } from '../kernel/truth.js';
import { calculateTaskUtility, calculateTotalUtility, KIND_UTILITY_WEIGHTS } from './utility.js';

/** Drive type. */
export const DRIVE_TYPES = [
  'curiosity',      // Seek novel/uncertain beliefs
  'competence',     // Achieve goals, improve skills
  'consistency',    // Resolve contradictions
  'efficiency',     // Minimize cost/risk
  'social',         // Communicate, align with others
  'survival',       // Avoid critical failures
] as const;

export type DriveType = (typeof DRIVE_TYPES)[number];

/** Drive specification. */
export interface Drive {
  /** Drive type. */
  type: DriveType;
  /** Weight [0,1]. */
  weight: number;
  /** Kind preferences. */
  kindWeights: Partial<Record<TaskBagKind, number>>;
  /** Source preferences. */
  sourceWeights: Partial<Record<TaskSource, number>>;
  /** Tag preferences. */
  tagWeights: Record<string, number>;
  /** Active. */
  active: boolean;
  /** Gradient contribution (computed). */
  gradient?: number[];
}

/** Default drive configurations. */
export const DEFAULT_DRIVES: Drive[] = [
  {
    type: 'curiosity',
    weight: 0.2,
    kindWeights: { belief: 1.5, goal: 0.5, skill: 1.0, faculty: 0.8, rule: 0.5, plan: 0.5 },
    sourceWeights: { perception: 1.2, reflex: 0.5, oracle: 1.0, derivation: 0.8, proposal: 1.0, curriculum: 0.8, growth: 1.0, repair: 0.5 },
    tagWeights: { novel: 2.0, uncertain: 1.5, surprise: 1.5 },
    active: true,
  },
  {
    type: 'competence',
    weight: 0.25,
    kindWeights: { belief: 0.8, goal: 2.0, skill: 2.0, faculty: 1.0, rule: 0.8, plan: 1.5 },
    sourceWeights: { perception: 0.5, reflex: 1.0, oracle: 1.2, derivation: 1.0, proposal: 1.0, curriculum: 1.0, growth: 1.2, repair: 0.8 },
    tagWeights: { goal: 2.0, skill: 1.5, progress: 1.5 },
    active: true,
  },
  {
    type: 'consistency',
    weight: 0.15,
    kindWeights: { belief: 2.0, goal: 0.5, skill: 0.5, faculty: 0.5, rule: 1.5, plan: 0.5 },
    sourceWeights: { perception: 0.8, reflex: 0.5, oracle: 0.8, derivation: 1.2, proposal: 0.5, curriculum: 0.5, growth: 0.5, repair: 1.5 },
    tagWeights: { contradiction: 2.0, revision: 1.5 },
    active: true,
  },
  {
    type: 'efficiency',
    weight: 0.15,
    kindWeights: { belief: 1.0, goal: 1.0, skill: 1.0, faculty: 1.0, rule: 1.0, plan: 0.8 },
    sourceWeights: { perception: 1.0, reflex: 1.0, oracle: 0.8, derivation: 0.8, proposal: 0.8, curriculum: 0.8, growth: 0.8, repair: 1.2 },
    tagWeights: { fast: 1.5, low_cost: 1.5, optimized: 1.3 },
    active: true,
  },
  {
    type: 'social',
    weight: 0.1,
    kindWeights: { belief: 0.8, goal: 1.2, skill: 1.0, faculty: 1.2, rule: 0.5, plan: 1.0 },
    sourceWeights: { perception: 1.0, reflex: 0.8, oracle: 1.0, derivation: 0.8, proposal: 1.0, curriculum: 1.2, growth: 1.0, repair: 0.8 },
    tagWeights: { communication: 2.0, dialogue: 1.5, alignment: 1.5 },
    active: true,
  },
  {
    type: 'survival',
    weight: 0.15,
    kindWeights: { belief: 1.2, goal: 1.5, skill: 1.0, faculty: 1.0, rule: 1.5, plan: 1.2 },
    sourceWeights: { perception: 1.5, reflex: 1.5, oracle: 1.0, derivation: 1.0, proposal: 0.5, curriculum: 0.5, growth: 0.8, repair: 2.0 },
    tagWeights: { critical: 2.0, safety: 2.0, veto: 1.5 },
    active: true,
  },
];

/** Gradient view — unified representation of all drives as a single weight field. */
export interface GradientView {
  /** Per-kind weight multipliers. */
  kindWeights: Record<TaskBagKind, number>;
  /** Per-source weight multipliers. */
  sourceWeights: Record<TaskSource, number>;
  /** Per-tag weight multipliers. */
  tagWeights: Record<string, number>;
  /** Active drives. */
  activeDrives: DriveType[];
  /** Total weight. */
  totalWeight: number;
}

/** Compute the gradient view from active drives. */
export function computeGradientView(drives: Drive[]): GradientView {
  const kindWeights: Record<string, number> = {};
  const sourceWeights: Record<string, number> = {};
  const tagWeights: Record<string, number> = {};
  const activeDrives: DriveType[] = [];
  let totalWeight = 0;

  for (const drive of drives) {
    if (!drive.active) continue;
    activeDrives.push(drive.type);
    totalWeight += drive.weight;

    // Accumulate kind weights
    for (const [kind, weight] of Object.entries(drive.kindWeights)) {
      kindWeights[kind] = (kindWeights[kind] ?? 1.0) * (1 + drive.weight * (weight - 1));
    }

    // Accumulate source weights
    for (const [source, weight] of Object.entries(drive.sourceWeights)) {
      sourceWeights[source] = (sourceWeights[source] ?? 1.0) * (1 + drive.weight * (weight - 1));
    }

    // Accumulate tag weights
    for (const [tag, weight] of Object.entries(drive.tagWeights)) {
      tagWeights[tag] = (tagWeights[tag] ?? 1.0) * (1 + drive.weight * (weight - 1));
    }
  }

  return {
    kindWeights: kindWeights as Record<TaskBagKind, number>,
    sourceWeights: sourceWeights as Record<TaskSource, number>,
    tagWeights,
    activeDrives,
    totalWeight,
  };
}

/** Apply gradient view as an overlay. */
export function gradientToOverlay(gradient: GradientView, id = 'drives-gradient'): Overlay {
  return {
    id,
    name: 'Drives Gradient',
    kindWeights: gradient.kindWeights,
    sourceWeights: gradient.sourceWeights,
    tagWeights: gradient.tagWeights,
    active: true,
  };
}

/** Compute utility gradient for a task (directional derivative). */
export function computeUtilityGradient(
  task: EconomyTask,
  gradient: GradientView,
  epsilon = 0.01
): number {
  // Finite difference approximation of utility w.r.t. drive weights
  const baseUtility = calculateTaskUtility(task, [], 0, {
    budgetPerIteration: 100,
    fairnessWindow: 1000,
    minWeight: 0.001,
    explorationRate: 0.05,
    aging: { decayRate: 0.995, minActivation: 0.01, accessBoost: 0.1, maxAge: 10000 },
    overlays: [gradientToOverlay(gradient)],
    metareasoningEnabled: false,
    marginThreshold: 0.15,
  });

  // Perturb each drive weight slightly and measure change
  let gradientSum = 0;
  for (const driveType of gradient.activeDrives) {
    const perturbedDrives = DEFAULT_DRIVES.map(d =>
      d.type === driveType ? { ...d, weight: d.weight + epsilon } : d
    );
    const perturbedGradient = computeGradientView(perturbedDrives);
    const perturbedUtility = calculateTaskUtility(task, [], 0, {
      budgetPerIteration: 100,
      fairnessWindow: 1000,
      minWeight: 0.001,
      explorationRate: 0.05,
      aging: { decayRate: 0.995, minActivation: 0.01, accessBoost: 0.1, maxAge: 10000 },
      overlays: [gradientToOverlay(perturbedGradient)],
      metareasoningEnabled: false,
      marginThreshold: 0.15,
    });
    gradientSum += (perturbedUtility.total - baseUtility.total) / epsilon;
  }

  return gradientSum;
}

/** Get drive contribution to task utility. */
export function getDriveContribution(task: EconomyTask, drives: Drive[]): Record<DriveType, number> {
  const contributions: Record<string, number> = {};

  for (const drive of drives) {
    if (!drive.active) continue;

    let contribution = drive.weight;

    // Kind contribution
    contribution *= drive.kindWeights[task.kind] ?? 1.0;

    // Source contribution
    contribution *= drive.sourceWeights[task.source] ?? 1.0;

    // Tag contribution
    for (const tag of task.tags) {
      if (drive.tagWeights[tag]) {
        contribution *= drive.tagWeights[tag];
      }
    }

    // Truth alignment (curiosity likes uncertainty, competence likes confidence)
    if (drive.type === 'curiosity') {
      contribution *= 1 - task.truth.c;
    } else if (drive.type === 'competence') {
      contribution *= task.truth.c;
    } else if (drive.type === 'consistency') {
      // Higher for tasks that resolve contradictions
      contribution *= task.tags.includes('contradiction') ? 2.0 : 1.0;
    } else if (drive.type === 'survival') {
      contribution *= task.tags.includes('critical') ? 2.0 : 1.0;
    }

    contributions[drive.type] = contribution;
  }

  return contributions as Record<DriveType, number>;
}

/** Update drive weights based on outcomes (gradient ascent). */
export function updateDrivesFromOutcomes(
  drives: Drive[],
  outcomes: Array<{ task: EconomyTask; utility: number; expectedUtility: number }>,
  learningRate = 0.01
): Drive[] {
  return drives.map(drive => {
    if (!drive.active) return drive;

    // Compute gradient: sum of (actual - expected) * task features for this drive
    let gradient = 0;
    for (const { task, utility, expectedUtility } of outcomes) {
      const surprise = utility - expectedUtility;
      const taskFeatures = getDriveContribution(task, [drive])[drive.type] ?? 0;
      gradient += surprise * taskFeatures;
    }

    // Update weight (constrained to [0,1])
    const newWeight = Math.max(0, Math.min(1, drive.weight + learningRate * gradient));

    return { ...drive, weight: newWeight };
  });
}

/** Create a drive configuration from a gradient view (inverse). */
export function drivesFromGradient(gradient: GradientView): Drive[] {
  // This is a simplified inverse; real implementation would use optimization
  return DEFAULT_DRIVES.map(d => ({
    ...d,
    weight: gradient.activeDrives.includes(d.type) ? 1.0 / gradient.activeDrives.length : 0,
    active: gradient.activeDrives.includes(d.type),
  }));
}