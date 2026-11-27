/**
 * Loop Types — shared type definitions for the cognitive loop.
 */
/** Default loop config. */
export const defaultLoopConfig = {
    maxIterations: 10000,
    iterationTimeoutMs: 5000,
    recordEnabled: true,
    contractsEnabled: true,
    repairEnabled: true,
    selfModelEnabled: true,
    appraisalEnabled: true,
};
/** Loop event types. */
export const LOOP_EVENTS = [
    'iteration_start',
    'iteration_complete',
    'iteration_failed',
    'selection_made',
    'action_executed',
    'judgment_complete',
    'contract_checked',
    'repair_complete',
    'appraisal_complete',
    'max_iterations_reached',
    'timeout',
];
