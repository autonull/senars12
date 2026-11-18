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
] as const;

export type ScenarioProfile = (typeof SCENARIO_PROFILES)[number];

/** Every profile with a template in `generateTemplateScenario` — i.e. all but `auto`. */
export type ScenarioTemplateProfile = Exclude<ScenarioProfile, 'auto'>;
