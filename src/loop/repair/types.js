/**
 * Repair Loop Types — shared type definitions.
 */
/** Anomaly types. */
export const ANOMALY_TYPES = [
    'stall',
    'divergence',
    'contradiction',
    'resource_exhaustion',
    'oracle_failure',
    'gate_failure',
    'contract_violation',
];
/** Anomaly severity. */
export const ANOMALY_SEVERITY = ['low', 'medium', 'high', 'critical'];
/** Repair ladder action types. */
export const REPAIR_LADDER_ACTIONS = [
    'reduce_scope',
    'increase_budget',
    'delegate',
    'fallback',
    'abort',
];
export const REPAIR_OPERATIONAL_ACTIONS = [
    'retry',
    'replan',
    'retrieve_context',
    'verify_premises',
    'escalate',
];
export const REPAIR_ACTIONS = [
    ...REPAIR_LADDER_ACTIONS,
    ...REPAIR_OPERATIONAL_ACTIONS,
];
