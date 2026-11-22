/**
 * Economy — the one task economy.
 *
 * Pure functions operating on EconomyState. No mutation, no event bus, deterministic.
 */

export * from './types';
export * from './utility';
export * from './metareasoning';
export * from './successor';
export * from './voi';
export * from './aging';
export * from './overlays';
export * from './drives';
export * from './td-learning';
export * from './pure';

import type { EconomyTask, SchedulerConfig, EconomyState, Successor } from './types';
import type { Env } from '../kernel/env';
import type { Clock, RNG } from '../kernel/env';
import { applyAging, calculateAgedPriority, getAgingPolicyForKind, isStale, getTasksForReview } from './aging';
import { calculateTaskUtility, calculateTotalUtility, rankTasksByUtility, calculateVoI } from './utility';
import { metareason, calculateMetareasoningBudget, evaluateMetareasoningOutcome } from './metareasoning';
import { generateSuccessors, type SuccessorContext, type GeneratedSuccessor } from './successor';
import { calculateDetailedVoI, rankByVoI, selectByVoI, type VoIContext, type VoIBreakdown } from './voi';
import { createTimePressureOverlay, createLearningOverlay, createMaintenanceOverlay, createCrisisOverlay, createExplorationOverlay, getBuiltinOverlays, applyOverlays, calculateEffectiveWeight, createOverlay, mergeOverlays } from './overlays';
import { getDriveContribution, type Drive, type DriveType, DEFAULT_DRIVES } from './drives';
import {
  createInitialState,
  addTask,
  removeTask,
  updateTask,
  getTask,
  getTasksByKind,
  getAllTasks,
  activateOverlay,
  deactivateOverlay,
  schedule,
  getStats,
  getPickHistory,
  setSeed,
  type SchedulerResult,
  type FairnessCheck,
  type FairnessViolation,
} from './pure';

/** Create initial economy state from config. */
export function createEconomyState(config?: Partial<SchedulerConfig>): EconomyState {
  return createInitialState(config);
}

/** Create initial economy state from Env. */
export function createEconomyStateFromEnv(env: Env, config?: Partial<SchedulerConfig>): EconomyState {
  return createInitialState({
    ...config,
    rng: env.rng,
    clock: env.clock,
    seed: config?.seed,
  });
}

/** Default economy state. */
export const defaultEconomyState = createInitialState();