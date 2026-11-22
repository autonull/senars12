/**
 * Economy — the one task economy.
 *
 * Replaces focus, strategies, drives, RL/RLFP/reflex, proposal and autonomy
 * with one task economy and one loop.
 */

export * from './types';
export * from './utility';
export * from './scheduler';
export * from './metareasoning';
export * from './successor';
export * from './voi';
export * from './aging';
export * from './overlays';
export * from './drives';
export * from './td-learning';

import { EconomyScheduler, createEconomyScheduler, createEconomySchedulerFromEnv, economyScheduler, type SchedulerResult } from './scheduler';
import type { EconomyTask, SchedulerConfig, EconomyState, Successor } from './types';
import type { Env } from '../kernel/env';
import { applyAging, calculateAgedPriority, getAgingPolicyForKind, isStale, getTasksForReview } from './aging';
import { calculateTaskUtility, calculateTotalUtility, rankTasksByUtility, calculateVoI } from './utility';
import { metareason, calculateMetareasoningBudget, evaluateMetareasoningOutcome } from './metareasoning';
import { generateSuccessors, type SuccessorContext, type GeneratedSuccessor } from './successor';
import { calculateDetailedVoI, rankByVoI, selectByVoI, type VoIContext, type VoIBreakdown } from './voi';
import { createTimePressureOverlay, createLearningOverlay, createMaintenanceOverlay, createCrisisOverlay, createExplorationOverlay, getBuiltinOverlays, applyOverlays, calculateEffectiveWeight, createOverlay, mergeOverlays } from './overlays';

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
  schedule(successors?: Map<string, import('./types').Successor[]>): SchedulerResult;
  /** Get state. */
  getState(): EconomyState;
  /** Get stats. */
  getStats(): import('./types').SchedulerStats;
  /** Activate overlay. */
  activateOverlay(overlay: import('./types').Overlay): void;
  /** Deactivate overlay. */
  deactivateOverlay(overlayId: string): void;
  /** Set RNG seed. */
  setSeed(seed: number): void;
  /** Subscribe to events. */
  on(type: import('./types').EconomyEventType, listener: (event: import('./types').EconomyEvent) => void): () => void;
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

/** Create a full economy instance from an Env. */
export function createEconomyFromEnv(env: Env, config?: Partial<SchedulerConfig>): Economy {
  const scheduler = createEconomySchedulerFromEnv(env, config);

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