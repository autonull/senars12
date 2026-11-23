/**
 * Overlays & Drives — context-specific weighting and drive machinery for the economy.
 *
 * Overlays allow dynamic adjustment of task weights based on context
 * (e.g., current goal, time pressure, resource constraints).
 *
 * Drives become a gradient over the task economy: each drive is a
 * weight vector over task kinds/sources that shapes the utility landscape.
 * This replaces the separate drive machinery with a single gradient view.
 */

import type { Overlay, TaskBagKind, TaskSource, EconomyTask, SchedulerConfig } from './types';
import type { Truth } from '../kernel/truth';
import { calculateTaskUtility, calculateTotalUtility, KIND_UTILITY_WEIGHTS } from './utility-voi';
import type { Clock, TimestampMs } from '../kernel/env';
import { createDefaultClock } from '../kernel/env';

// ============================================================================
// Overlays
// ============================================================================

/** Built-in overlay IDs. */
export const BUILTIN_OVERLAYS = {
  /** High time pressure: prioritize goals and skills. */
  TIME_PRESSURE: 'time-pressure',
  /** Learning mode: prioritize skills and beliefs. */
  LEARNING: 'learning',
  /** Maintenance mode: prioritize beliefs and rules. */
  MAINTENANCE: 'maintenance',
  /** Crisis mode: prioritize goals only. */
  CRISIS: 'crisis',
  /** Exploration mode: boost all exploration. */
  EXPLORATION: 'exploration',
} as const;

/** Overlay configuration for factory. */
interface OverlayConfig {
  id: string;
  name: string;
  kindWeights: Partial<Record<TaskBagKind, number>>;
  sourceWeights: Partial<Record<TaskSource, number>>;
  tagWeights: Record<string, number>;
}

/** Built-in overlay configurations. */
const OVERLAY_CONFIGS: Record<typeof BUILTIN_OVERLAYS[keyof typeof BUILTIN_OVERLAYS], OverlayConfig> = {
  [BUILTIN_OVERLAYS.TIME_PRESSURE]: {
    id: BUILTIN_OVERLAYS.TIME_PRESSURE,
    name: 'Time Pressure',
    kindWeights: { goal: 2.0, skill: 1.5, plan: 1.3, belief: 0.5, faculty: 0.7, rule: 0.3 },
    sourceWeights: { reflex: 1.5, oracle: 1.3, perception: 1.2, derivation: 0.8, proposal: 0.7, curriculum: 0.5, growth: 0.3, repair: 1.0 },
    tagWeights: { urgent: 2.0, critical: 2.5, deadline: 1.8 },
  },
  [BUILTIN_OVERLAYS.LEARNING]: {
    id: BUILTIN_OVERLAYS.LEARNING,
    name: 'Learning Mode',
    kindWeights: { skill: 2.0, belief: 1.5, goal: 1.2, faculty: 1.0, rule: 0.8, plan: 0.7 },
    sourceWeights: { curriculum: 2.0, growth: 1.5, derivation: 1.2, oracle: 1.0, perception: 1.0, reflex: 0.8, proposal: 0.7, repair: 0.5 },
    tagWeights: { learning: 2.0, practice: 1.5, experiment: 1.3, curiosity: 1.5 },
  },
  [BUILTIN_OVERLAYS.MAINTENANCE]: {
    id: BUILTIN_OVERLAYS.MAINTENANCE,
    name: 'Maintenance Mode',
    kindWeights: { belief: 1.8, rule: 1.5, faculty: 1.2, skill: 1.0, goal: 0.8, plan: 0.6 },
    sourceWeights: { derivation: 1.5, repair: 1.3, oracle: 1.0, perception: 0.8, curriculum: 0.7, growth: 0.5, reflex: 0.5, proposal: 0.4 },
    tagWeights: { maintenance: 2.0, cleanup: 1.5, verify: 1.3, consolidate: 1.2 },
  },
  [BUILTIN_OVERLAYS.CRISIS]: {
    id: BUILTIN_OVERLAYS.CRISIS,
    name: 'Crisis Mode',
    kindWeights: { goal: 3.0, plan: 1.5, skill: 1.0, belief: 0.3, faculty: 0.5, rule: 0.2 },
    sourceWeights: { reflex: 2.0, oracle: 1.5, perception: 1.3, derivation: 0.5, repair: 1.0, proposal: 0.3, curriculum: 0.1, growth: 0.1 },
    tagWeights: { emergency: 3.0, survival: 2.5, safety: 2.0, critical: 2.0 },
  },
  [BUILTIN_OVERLAYS.EXPLORATION]: {
    id: BUILTIN_OVERLAYS.EXPLORATION,
    name: 'Exploration Mode',
    kindWeights: { goal: 1.3, skill: 1.3, belief: 1.2, plan: 1.1, faculty: 1.0, rule: 0.9 },
    sourceWeights: { proposal: 1.5, curriculum: 1.3, growth: 1.2, oracle: 1.1, derivation: 1.0, reflex: 1.0, perception: 1.0, repair: 0.8 },
    tagWeights: { explore: 2.0, novel: 1.5, unknown: 1.3, experiment: 1.2 },
  },
};

/** Create an overlay from config. */
function createOverlayFromConfig(config: OverlayConfig, active = true): Overlay {
  return { ...config, active };
}

/** Create time pressure overlay. */
export const createTimePressureOverlay = (active = true): Overlay =>
  createOverlayFromConfig(OVERLAY_CONFIGS[BUILTIN_OVERLAYS.TIME_PRESSURE], active);

/** Create learning overlay. */
export const createLearningOverlay = (active = true): Overlay =>
  createOverlayFromConfig(OVERLAY_CONFIGS[BUILTIN_OVERLAYS.LEARNING], active);

/** Create maintenance overlay. */
export const createMaintenanceOverlay = (active = true): Overlay =>
  createOverlayFromConfig(OVERLAY_CONFIGS[BUILTIN_OVERLAYS.MAINTENANCE], active);

/** Create crisis overlay. */
export const createCrisisOverlay = (active = true): Overlay =>
  createOverlayFromConfig(OVERLAY_CONFIGS[BUILTIN_OVERLAYS.CRISIS], active);

/** Create exploration overlay. */
export const createExplorationOverlay = (active = true): Overlay =>
  createOverlayFromConfig(OVERLAY_CONFIGS[BUILTIN_OVERLAYS.EXPLORATION], active);

/** Get all built-in overlays. */
export function getBuiltinOverlays(): Overlay[] {
  return [
    createTimePressureOverlay(false),
    createLearningOverlay(false),
    createMaintenanceOverlay(false),
    createCrisisOverlay(false),
    createExplorationOverlay(false),
  ];
}

/** Apply overlays to scheduler config. */
export function applyOverlays(config: SchedulerConfig, overlayIds: string[]): SchedulerConfig {
  const builtins = getBuiltinOverlays();
  const activeOverlays = builtins.filter(o => overlayIds.includes(o.id));

  return {
    ...config,
    overlays: activeOverlays.map(o => ({ ...o, active: true })),
  };
}

/** Create custom overlay. */
export function createOverlay(
  id: string,
  name: string,
  kindWeights: Partial<Record<TaskBagKind, number>> = {},
  sourceWeights: Partial<Record<TaskSource, number>> = {},
  tagWeights: Record<string, number> = {},
  active = true
): Overlay {
  return { id, name, kindWeights, sourceWeights, tagWeights, active };
}

/** Calculate effective weight for a task with overlays. */
export function calculateEffectiveWeight(task: EconomyTask, overlays: Overlay[]): number {
  let multiplier = 1.0;

  for (const overlay of overlays) {
    if (!overlay.active) continue;

    // Kind weight
    multiplier *= overlay.kindWeights[task.kind] ?? 1.0;

    // Source weight
    multiplier *= overlay.sourceWeights[task.source] ?? 1.0;

    // Tag weights
    for (const tag of task.tags) {
      if (overlay.tagWeights[tag]) {
        multiplier *= overlay.tagWeights[tag];
      }
    }
  }

  return task.weight * multiplier;
}

/** Get active overlay IDs from config. */
export function getActiveOverlayIds(config: SchedulerConfig): string[] {
  return config.overlays.filter(o => o.active).map(o => o.id);
}

/** Check if any overlay is active. */
export function hasActiveOverlays(config: SchedulerConfig): boolean {
  return config.overlays.some(o => o.active);
}

/** Merge multiple overlay configs. */
export function mergeOverlays(overlays: Overlay[], clock?: Clock): Overlay {
  const now: TimestampMs = (clock ?? createDefaultClock()).now();
  const merged: Overlay = {
    id: 'merged-' + now,
    name: 'Merged Overlay',
    kindWeights: {},
    sourceWeights: {},
    tagWeights: {},
    active: true,
  };

  for (const overlay of overlays) {
    if (!overlay.active) continue;

    // Multiply weights (combine multiplicatively)
    for (const [kind, weight] of Object.entries(overlay.kindWeights)) {
      merged.kindWeights[kind as TaskBagKind] =
        (merged.kindWeights[kind as TaskBagKind] ?? 1.0) * weight;
    }

    for (const [source, weight] of Object.entries(overlay.sourceWeights)) {
      merged.sourceWeights[source as TaskSource] =
        (merged.sourceWeights[source as TaskSource] ?? 1.0) * weight;
    }

    for (const [tag, weight] of Object.entries(overlay.tagWeights)) {
      merged.tagWeights[tag] = (merged.tagWeights[tag] ?? 1.0) * weight;
    }
  }

  return merged;
}

// ============================================================================
// Drives
// ============================================================================

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