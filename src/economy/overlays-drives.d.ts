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
import type { Overlay, EconomyTaskBagKind, TaskSource, EconomyTask, SchedulerConfig } from './types';
import type { Clock } from '../kernel/env';
/** Built-in overlay IDs. */
export declare const BUILTIN_OVERLAYS: {
    /** High time pressure: prioritize goals and skills. */
    readonly TIME_PRESSURE: 'time-pressure';
    /** Learning mode: prioritize skills and beliefs. */
    readonly LEARNING: 'learning';
    /** Maintenance mode: prioritize beliefs and rules. */
    readonly MAINTENANCE: 'maintenance';
    /** Crisis mode: prioritize goals only. */
    readonly CRISIS: 'crisis';
    /** Exploration mode: boost all exploration. */
    readonly EXPLORATION: 'exploration';
};
/** Create time pressure overlay. */
export declare const createTimePressureOverlay: (active?: boolean) => Overlay;
/** Create learning overlay. */
export declare const createLearningOverlay: (active?: boolean) => Overlay;
/** Create maintenance overlay. */
export declare const createMaintenanceOverlay: (active?: boolean) => Overlay;
/** Create crisis overlay. */
export declare const createCrisisOverlay: (active?: boolean) => Overlay;
/** Create exploration overlay. */
export declare const createExplorationOverlay: (active?: boolean) => Overlay;
/** Get all built-in overlays. */
export declare function getBuiltinOverlays(): Overlay[];
/** Apply overlays to scheduler config. */
export declare function applyOverlays(config: SchedulerConfig, overlayIds: string[]): SchedulerConfig;
/** Create custom overlay. */
export declare function createOverlay(id: string, name: string, kindWeights?: Partial<Record<EconomyTaskBagKind, number>>, sourceWeights?: Partial<Record<TaskSource, number>>, tagWeights?: Record<string, number>, active?: boolean): Overlay;
/** Calculate effective weight for a task with overlays. */
export declare function calculateEffectiveWeight(task: EconomyTask, overlays: Overlay[]): number;
/** Get active overlay IDs from config. */
export declare function getActiveOverlayIds(config: SchedulerConfig): string[];
/** Check if any overlay is active. */
export declare function hasActiveOverlays(config: SchedulerConfig): boolean;
/** Merge multiple overlay configs. */
export declare function mergeOverlays(overlays: Overlay[], clock?: Clock): Overlay;
/** Drive type. */
export declare const DRIVE_TYPES: readonly ['curiosity', 'competence', 'consistency', 'efficiency', 'social', 'survival'];
export type DriveType = (typeof DRIVE_TYPES)[number];
/** Drive specification. */
export interface Drive {
    /** Drive type. */
    type: DriveType;
    /** Weight [0,1]. */
    weight: number;
    /** Kind preferences. */
    kindWeights: Partial<Record<EconomyTaskBagKind, number>>;
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
export declare const DEFAULT_DRIVES: Drive[];
/** Gradient view — unified representation of all drives as a single weight field. */
export interface GradientView {
    /** Per-kind weight multipliers. */
    kindWeights: Record<EconomyTaskBagKind, number>;
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
export declare function computeGradientView(drives: Drive[]): GradientView;
/** Apply gradient view as an overlay. */
export declare function gradientToOverlay(gradient: GradientView, id?: string): Overlay;
/** Compute utility gradient for a task (directional derivative). */
export declare function computeUtilityGradient(task: EconomyTask, gradient: GradientView, epsilon?: number): number;
/** Get drive contribution to task utility. */
export declare function getDriveContribution(task: EconomyTask, drives: Drive[]): Record<DriveType, number>;
/** Update drive weights based on outcomes (gradient ascent). */
export declare function updateDrivesFromOutcomes(drives: Drive[], outcomes: Array<{
    task: EconomyTask;
    utility: number;
    expectedUtility: number;
}>, learningRate?: number): Drive[];
/** Create a drive configuration from a gradient view (inverse). */
export declare function drivesFromGradient(gradient: GradientView): Drive[];
//# sourceMappingURL=overlays-drives.d.ts.map