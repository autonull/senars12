/**
 * Economy Types — core types for the task economy.
 *
 * The economy replaces focus, strategies, drives, RL/RLFP/reflex, proposal and autonomy
 * with one task economy and one loop.
 */
/** Economy task bag kinds — extends NAR task vocabulary with economy-specific kinds. */
export const ECONOMY_TASK_BAG_KINDS = [
    'belief',
    'goal',
    'skill',
    'faculty',
    'rule',
    'plan',
];
/** Task source. */
export const TASK_SOURCES = [
    'perception',
    'reflex',
    'oracle',
    'derivation',
    'proposal',
    'curriculum',
    'growth',
    'repair',
    'faculty',
];
/** Metareasoning decision. */
export const METAREASONING_DECISIONS = ['think', 'act', 'delegate', 'defer'];
/** Default scheduler config. */
export const defaultSchedulerConfig = {
    budgetPerIteration: 100,
    fairnessWindow: 1000,
    minWeight: 0.001,
    explorationRate: 0.05,
    aging: {
        decayRate: 0.995,
        minActivation: 0.01,
        accessBoost: 0.1,
        maxAge: 10000,
    },
    overlays: [],
    metareasoningEnabled: true,
    marginThreshold: 0.15,
};
/** Economy event. */
export const ECONOMY_EVENTS = [
    'task_added',
    'task_removed',
    'task_updated',
    'task_scheduled',
    'task_completed',
    'task_failed',
    'overlay_activated',
    'overlay_deactivated',
    'budget_exhausted',
    'fairness_violation',
];
