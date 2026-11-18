/**
 * Overlays — context-specific weighting for the economy.
 *
 * Overlays allow dynamic adjustment of task weights based on context
 * (e.g., current goal, time pressure, resource constraints).
 */

import type { Overlay, TaskBagKind, TaskSource, EconomyTask, SchedulerConfig } from './types.js';

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

/** Create time pressure overlay. */
export function createTimePressureOverlay(active = true): Overlay {
  return {
    id: BUILTIN_OVERLAYS.TIME_PRESSURE,
    name: 'Time Pressure',
    kindWeights: {
      goal: 2.0,
      skill: 1.5,
      plan: 1.3,
      belief: 0.5,
      faculty: 0.7,
      rule: 0.3,
    },
    sourceWeights: {
      reflex: 1.5,
      oracle: 1.3,
      perception: 1.2,
      derivation: 0.8,
      proposal: 0.7,
      curriculum: 0.5,
      growth: 0.3,
      repair: 1.0,
    },
    tagWeights: {
      urgent: 2.0,
      critical: 2.5,
      deadline: 1.8,
    },
    active,
  };
}

/** Create learning overlay. */
export function createLearningOverlay(active = true): Overlay {
  return {
    id: BUILTIN_OVERLAYS.LEARNING,
    name: 'Learning Mode',
    kindWeights: {
      skill: 2.0,
      belief: 1.5,
      goal: 1.2,
      faculty: 1.0,
      rule: 0.8,
      plan: 0.7,
    },
    sourceWeights: {
      curriculum: 2.0,
      growth: 1.5,
      derivation: 1.2,
      oracle: 1.0,
      perception: 1.0,
      reflex: 0.8,
      proposal: 0.7,
      repair: 0.5,
    },
    tagWeights: {
      learning: 2.0,
      practice: 1.5,
      experiment: 1.3,
      curiosity: 1.5,
    },
    active,
  };
}

/** Create maintenance overlay. */
export function createMaintenanceOverlay(active = true): Overlay {
  return {
    id: BUILTIN_OVERLAYS.MAINTENANCE,
    name: 'Maintenance Mode',
    kindWeights: {
      belief: 1.8,
      rule: 1.5,
      faculty: 1.2,
      skill: 1.0,
      goal: 0.8,
      plan: 0.6,
    },
    sourceWeights: {
      derivation: 1.5,
      repair: 1.3,
      oracle: 1.0,
      perception: 0.8,
      curriculum: 0.7,
      growth: 0.5,
      reflex: 0.5,
      proposal: 0.4,
    },
    tagWeights: {
      maintenance: 2.0,
      cleanup: 1.5,
      verify: 1.3,
      consolidate: 1.2,
    },
    active,
  };
}

/** Create crisis overlay. */
export function createCrisisOverlay(active = true): Overlay {
  return {
    id: BUILTIN_OVERLAYS.CRISIS,
    name: 'Crisis Mode',
    kindWeights: {
      goal: 3.0,
      plan: 1.5,
      skill: 1.0,
      belief: 0.3,
      faculty: 0.5,
      rule: 0.2,
    },
    sourceWeights: {
      reflex: 2.0,
      oracle: 1.5,
      perception: 1.3,
      derivation: 0.5,
      repair: 1.0,
      proposal: 0.3,
      curriculum: 0.1,
      growth: 0.1,
    },
    tagWeights: {
      emergency: 3.0,
      survival: 2.5,
      safety: 2.0,
      critical: 2.0,
    },
    active,
  };
}

/** Create exploration overlay. */
export function createExplorationOverlay(active = true): Overlay {
  return {
    id: BUILTIN_OVERLAYS.EXPLORATION,
    name: 'Exploration Mode',
    kindWeights: {
      goal: 1.3,
      skill: 1.3,
      belief: 1.2,
      plan: 1.1,
      faculty: 1.0,
      rule: 0.9,
    },
    sourceWeights: {
      proposal: 1.5,
      curriculum: 1.3,
      growth: 1.2,
      oracle: 1.1,
      derivation: 1.0,
      reflex: 1.0,
      perception: 1.0,
      repair: 0.8,
    },
    tagWeights: {
      explore: 2.0,
      novel: 1.5,
      unknown: 1.3,
      experiment: 1.2,
    },
    active,
  };
}

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
export function mergeOverlays(overlays: Overlay[]): Overlay {
  const merged: Overlay = {
    id: 'merged-' + Date.now(),
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