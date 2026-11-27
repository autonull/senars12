/**
 * The single list of scenario profiles. `scenario-execute` keys its templates
 * off it and every scenario tool schema validates against it, so adding a
 * profile is a one-line change here.
 */
export const SCENARIO_PROFILES = [
    'contradictory_sensors',
    'temporal_reasoning',
    'resource_pressure',
    'belief_revision',
    'cross_engine_sync',
    'auto',
];
