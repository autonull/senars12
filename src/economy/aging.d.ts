/**
 * Aging — task aging and decay policies for the economy.
 *
 * Manages activation decay, access-based boosting, and stale task removal.
 */
import type { EconomyTask, AgingPolicy, EconomyTaskBagKind } from './types';
import type { Histogram } from '@senars/util/bag';
import type { Clock } from '../kernel/env';
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
export declare const defaultAgingPolicy: AgingPolicy;
/** Kind-specific aging modifiers. */
export declare const KIND_AGING_MODIFIERS: Record<EconomyTaskBagKind, {
    decayMult: number;
    boostMult: number;
    maxAgeMult: number;
}>;
/**
 * Apply aging to all tasks.
 */
export declare function applyAging(tasks: Map<string, EconomyTask>, policy: AgingPolicy | undefined, currentIteration: number, clock?: Clock): AgingStats;
/**
 * Calculate task priority with aging considered.
 */
export declare function calculateAgedPriority(task: EconomyTask, policy?: AgingPolicy, clock?: Clock): number;
/**
 * Get aging policy for a specific task kind.
 */
export declare function getAgingPolicyForKind(kind: EconomyTaskBagKind, basePolicy?: AgingPolicy): AgingPolicy;
/**
 * Check if a task is stale (should be considered for removal).
 */
export declare function isStale(task: EconomyTask, policy?: AgingPolicy, clock?: Clock): boolean;
/**
 * Get tasks that should be reviewed (old but potentially valuable).
 */
export declare function getTasksForReview(tasks: EconomyTask[], policy?: AgingPolicy, maxAgeHours?: number, // 1 week
clock?: Clock): EconomyTask[];
//# sourceMappingURL=aging.d.ts.map