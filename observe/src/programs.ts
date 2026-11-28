import type { ScenarioSpec, ScenarioProfile } from '@senars/tools/adapters/scenario-execute';
import { SCENARIO_PROFILES } from '@senars/tools/adapters/scenario-profiles';

export interface ObserveProgram extends ScenarioSpec {
  observe: {
    surfaces: ('console' | 'ui')[];
    keyframeMarks: string[];
    maxFrames: number;
    reviewerPrompt?: string;
    lane: 'hermetic' | 'live';
  };
}

const seedPrograms: Record<ScenarioProfile, ObserveProgram> = {
  contradictory_sensors: {
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
    metadata: { seed: '', generated_at: '', profile: 'contradictory_sensors' },
    observe: {
      surfaces: ['console'],
      keyframeMarks: ['inject_0', 'inject_1', 'contradiction_detected_within'],
      maxFrames: 12,
      lane: 'hermetic',
    },
  },
  temporal_reasoning: {
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
    metadata: { seed: '', generated_at: '', profile: 'temporal_reasoning' },
    observe: {
      surfaces: ['console'],
      keyframeMarks: ['inject_0', 'inject_1', 'specific_belief_derived:event_A==>event_C'],
      maxFrames: 12,
      lane: 'hermetic',
    },
  },
  resource_pressure: {
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
    metadata: { seed: '', generated_at: '', profile: 'resource_pressure' },
    observe: {
      surfaces: ['console'],
      keyframeMarks: ['inject_0', 'inject_1', 'response_latency_p95'],
      maxFrames: 12,
      lane: 'hermetic',
    },
  },
  belief_revision: {
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
    metadata: { seed: '', generated_at: '', profile: 'belief_revision' },
    observe: {
      surfaces: ['console'],
      keyframeMarks: ['inject_0', 'inject_1', 'contradiction_detected_within'],
      maxFrames: 12,
      lane: 'hermetic',
    },
  },
  cross_engine_sync: {
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
    metadata: { seed: '', generated_at: '', profile: 'cross_engine_sync' },
    observe: {
      surfaces: ['console'],
      keyframeMarks: ['inject_0', 'inject_1', 'specific_belief_derived:nar_fact<->metta_atom'],
      maxFrames: 12,
      lane: 'hermetic',
    },
  },
  auto: {
    name: 'auto',
    description: 'Auto-generated scenario',
    duration_steps: 300,
    inject: [],
    success_criteria: { no_crash: true },
    metadata: { seed: '', generated_at: '', profile: 'auto' },
    observe: {
      surfaces: ['console'],
      keyframeMarks: [],
      maxFrames: 12,
      lane: 'hermetic',
    },
  },
  regression: {
    name: 'regression',
    description: 'Regression test fixture',
    duration_steps: 100,
    inject: [],
    success_criteria: { no_crash: true },
    metadata: { seed: '', generated_at: '', profile: 'regression' },
    observe: {
      surfaces: ['console'],
      keyframeMarks: [],
      maxFrames: 12,
      lane: 'hermetic',
    },
  },
};

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