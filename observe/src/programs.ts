import type { ScenarioSpec, ScenarioProfile } from '@senars/tools/adapters/scenario-execute';
import { SCENARIO_PROFILES } from '@senars/tools/adapters/scenario-profiles';

export interface ObserveProgram extends ScenarioSpec {
  observe: {
    surfaces: ('console' | 'ui')[];
    keyframeMarks: string[];
    maxFrames: number;
    reviewerPrompt?: string;
    lane: 'hermetic' | 'live';
    uiUrl?: string;
  };
}

interface ProgramSpec {
  name: ScenarioProfile;
  description: string;
  duration_steps: number;
  inject: ScenarioSpec['inject'];
  success_criteria: ScenarioSpec['success_criteria'];
  keyframeMarks: string[];
}

const baseObserve = {
  surfaces: ['console'] as const,
  maxFrames: 12,
  lane: 'hermetic' as const,
};

function createProgram(spec: ProgramSpec): ObserveProgram {
  return {
    name: spec.name,
    description: spec.description,
    duration_steps: spec.duration_steps,
    inject: spec.inject,
    success_criteria: spec.success_criteria,
    metadata: { seed: '', generated_at: '', profile: spec.name },
    observe: {
      ...baseObserve,
      keyframeMarks: spec.keyframeMarks,
    },
  };
}

const programSpecs: ProgramSpec[] = [
  {
    name: 'contradictory_sensors',
    description: 'Test handling of contradictory sensor inputs',
    duration_steps: 500,
    inject: [
      { type: 'belief_stream', pattern: '(sensor_A --> sensor_B). %0.9;0.9%', interval: 5 },
      { type: 'belief_stream', pattern: '(sensor_B --> sensor_A). %0.1;0.9%', interval: 5 },
      { type: 'question', pattern: '(sensor_A --> ?what)?', interval: 20 },
      { type: 'resource_pressure', maxDerivationsPerStep: 50 },
    ],
    success_criteria: {
      no_crash: true,
      contradiction_detected_within: 10,
      response_latency_p95: 100,
      min_derivations: 5,
    },
    keyframeMarks: ['inject_0', 'inject_1', 'contradiction_detected_within'],
  },
  {
    name: 'temporal_reasoning',
    description: 'Test event sequences with delayed evidence',
    duration_steps: 300,
    inject: [
      { type: 'belief_stream', pattern: '(event_A * event_B * event_C). %0.8;0.8%', interval: 10 },
      { type: 'question', pattern: '(event_A ==> event_C)?', interval: 30 },
      { type: 'resource_pressure', maxDerivationsPerStep: 100 },
    ],
    success_criteria: {
      no_crash: true,
      min_derivations: 3,
      specific_belief_derived: 'event_A ==> event_C',
    },
    keyframeMarks: ['inject_0', 'inject_1', 'specific_belief_derived:event_A==>event_C'],
  },
  {
    name: 'resource_pressure',
    description: 'Test AIKR graceful degradation under load',
    duration_steps: 400,
    inject: [
      { type: 'belief_stream', pattern: '(data --> pattern). %0.7;0.7%', interval: 2 },
      { type: 'resource_pressure', maxDerivationsPerStep: 20 },
      { type: 'question', pattern: '(data --> ?what)?', interval: 15 },
    ],
    success_criteria: {
      no_crash: true,
      response_latency_p95: 50,
      min_derivations: 10,
    },
    keyframeMarks: ['inject_0', 'inject_1', 'response_latency_p95'],
  },
  {
    name: 'belief_revision',
    description: 'Test belief revision with incoming evidence streams',
    duration_steps: 350,
    inject: [
      { type: 'belief_stream', pattern: '(hypothesis --> confirmed). %0.6;0.6%', interval: 8 },
      { type: 'belief_stream', pattern: '(hypothesis --> refuted). %0.9;0.8%', interval: 20 },
      { type: 'question', pattern: '(hypothesis --> ?what)?', interval: 25 },
    ],
    success_criteria: {
      no_crash: true,
      contradiction_detected_within: 15,
      min_derivations: 5,
    },
    keyframeMarks: ['inject_0', 'inject_1', 'contradiction_detected_within'],
  },
  {
    name: 'cross_engine_sync',
    description: 'Test NAR-MeTTa coordination',
    duration_steps: 250,
    inject: [
      { type: 'belief_stream', pattern: '(nar_fact <-> metta_atom). %0.8;0.8%', interval: 10 },
      { type: 'goal', narsese: '(^sync(nar_fact, metta_atom))!', priority: 0.7 },
      { type: 'question', pattern: '(nar_fact <-> ?what)?', interval: 20 },
    ],
    success_criteria: {
      no_crash: true,
      min_derivations: 3,
      specific_belief_derived: 'nar_fact <-> metta_atom',
    },
    keyframeMarks: ['inject_0', 'inject_1', 'specific_belief_derived:nar_fact<->metta_atom'],
  },
  {
    name: 'auto',
    description: 'Auto-generated scenario',
    duration_steps: 300,
    inject: [],
    success_criteria: { no_crash: true },
    keyframeMarks: [],
  },
  {
    name: 'regression',
    description: 'Regression test fixture',
    duration_steps: 100,
    inject: [],
    success_criteria: { no_crash: true },
    keyframeMarks: [],
  },
];

const seedPrograms: Record<ScenarioProfile, ObserveProgram> = Object.fromEntries(
  programSpecs.map((spec) => [spec.name, createProgram(spec)])
) as Record<ScenarioProfile, ObserveProgram>;

export function getObserveProgram(profile: ScenarioProfile, seed: string): ObserveProgram {
  const base = seedPrograms[profile] ?? seedPrograms.contradictory_sensors;
  return {
    ...base,
    metadata: { ...base.metadata, seed, generated_at: new Date().toISOString() },
  };
}

export function listObservePrograms(): ObserveProgram[] {
  return SCENARIO_PROFILES.map((p: string) => getObserveProgram(p as any, 'default-seed'));
}

export { SCENARIO_PROFILES };
export type { ScenarioProfile };