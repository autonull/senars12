/**
 * Economy — the one task economy.
 *
 * Replaces focus, strategies, drives, RL/RLFP/reflex, proposal and autonomy
 * with one task economy and one loop.
 */

export * from './types.js';
export * from './utility.js';
export * from './scheduler.js';
export * from './metareasoning.js';
export * from './successor.js';
export * from './voi.js';
export * from './aging.js';
export * from './overlays.js';
export * from './drives.js';
export * from './td-learning.js';

import { EconomyScheduler, createEconomyScheduler, economyScheduler, type SchedulerResult } from './scheduler.js';
import type { EconomyTask, SchedulerConfig, EconomyState, Successor } from './types.js';
import { applyAging, calculateAgedPriority, getAgingPolicyForKind, isStale, getTasksForReview } from './aging.js';
import { calculateTaskUtility, calculateTotalUtility, rankTasksByUtility, calculateVoI } from './utility.js';
import { metareason, calculateMetareasoningBudget, evaluateMetareasoningOutcome } from './metareasoning.js';
import { generateSuccessors, type SuccessorContext, type GeneratedSuccessor } from './successor.js';
import { calculateDetailedVoI, rankByVoI, selectByVoI, type VoIContext, type VoIBreakdown } from './voi.js';
import { createTimePressureOverlay, createLearningOverlay, createMaintenanceOverlay, createCrisisOverlay, createExplorationOverlay, getBuiltinOverlays, applyOverlays, calculateEffectiveWeight, createOverlay, mergeOverlays } from './overlays.js';

/** High-level economy interface. */
export interface Economy {
  /** Add a task. */
  addTask(task: EconomyTask): void;
  /** Remove a task. */
  removeTask(taskId: string): boolean;
  /** Update a task. */
  updateTask(taskId: string, updates: Partial<EconomyTask>): boolean;
  /** Get a task. */
  getTask(taskId: string): EconomyTask | undefined;
  /** Get tasks by kind. */
  getTasksByKind(kind: EconomyTask['kind']): EconomyTask[];
  /** Get all tasks. */
  getAllTasks(): EconomyTask[];
  /** Schedule next task. */
  schedule(successors?: Map<string, import('./types.js').Successor[]>): SchedulerResult;
  /** Get state. */
  getState(): EconomyState;
  /** Get stats. */
  getStats(): import('./types.js').SchedulerStats;
  /** Activate overlay. */
  activateOverlay(overlay: import('./types.js').Overlay): void;
  /** Deactivate overlay. */
  deactivateOverlay(overlayId: string): void;
  /** Set RNG seed. */
  setSeed(seed: number): void;
  /** Subscribe to events. */
  on(type: import('./types.js').EconomyEventType, listener: (event: import('./types.js').EconomyEvent) => void): () => void;
}

/** Create a full economy instance. */
export function createEconomy(config?: Partial<SchedulerConfig>): Economy {
  const scheduler = createEconomyScheduler(config);

  return {
    addTask: (task) => scheduler.addTask(task),
    removeTask: (id) => scheduler.removeTask(id),
    updateTask: (id, updates) => scheduler.updateTask(id, updates),
    getTask: (id) => scheduler.getTask(id),
    getTasksByKind: (kind) => scheduler.getTasksByKind(kind),
    getAllTasks: () => scheduler.getAllTasks(),
    schedule: (successors) => scheduler.schedule(successors),
    getState: () => scheduler.getState(),
    getStats: () => scheduler.getStats(),
    activateOverlay: (overlay) => scheduler.activateOverlay(overlay),
    deactivateOverlay: (id) => scheduler.deactivateOverlay(id),
    setSeed: (seed) => scheduler.setSeed(seed),
    on: (type, listener) => scheduler.on(type, listener),
  };
}

/** Default economy instance. */
export const economy = createEconomy();