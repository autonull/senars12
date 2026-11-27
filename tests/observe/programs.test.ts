import { describe, it, expect } from 'vitest';
import { getObserveProgram, listObservePrograms, SCENARIO_PROFILES } from '../../observe/src/programs.js';

describe('observe programs', () => {
  it('lists all scenario profiles', () => {
    expect(SCENARIO_PROFILES).toContain('contradictory_sensors');
    expect(SCENARIO_PROFILES).toContain('temporal_reasoning');
    expect(SCENARIO_PROFILES).toContain('resource_pressure');
    expect(SCENARIO_PROFILES).toContain('belief_revision');
    expect(SCENARIO_PROFILES).toContain('cross_engine_sync');
    expect(SCENARIO_PROFILES).toContain('auto');
  });

  it('creates observe program for contradictory_sensors', () => {
    const program = getObserveProgram('contradictory_sensors', 'test-seed');
    expect(program.name).toBe('contradictory_sensors');
    expect(program.observe.surfaces).toContain('console');
    expect(program.observe.keyframeMarks).toContain('inject_0');
    expect(program.observe.keyframeMarks).toContain('inject_1');
    expect(program.observe.keyframeMarks).toContain('contradiction_detected_within');
    expect(program.observe.maxFrames).toBe(12);
    expect(program.observe.lane).toBe('hermetic');
    expect(program.metadata.seed).toBe('test-seed');
  });

  it('creates observe program for temporal_reasoning', () => {
    const program = getObserveProgram('temporal_reasoning', 'test-seed');
    expect(program.name).toBe('temporal_reasoning');
    expect(program.success_criteria.specific_belief_derived).toBe('event_A ==> event_C');
    expect(program.observe.keyframeMarks).toContain('specific_belief_derived:event_A==>event_C');
  });

  it('creates observe program for resource_pressure', () => {
    const program = getObserveProgram('resource_pressure', 'test-seed');
    expect(program.name).toBe('resource_pressure');
    expect(program.success_criteria.response_latency_p95).toBe(50);
  });

  it('creates observe program for belief_revision', () => {
    const program = getObserveProgram('belief_revision', 'test-seed');
    expect(program.name).toBe('belief_revision');
    expect(program.success_criteria.contradiction_detected_within).toBe(15);
  });

  it('creates observe program for cross_engine_sync', () => {
    const program = getObserveProgram('cross_engine_sync', 'test-seid');
    expect(program.name).toBe('cross_engine_sync');
    expect(program.success_criteria.specific_belief_derived).toBe('nar_fact <-> metta_atom');
  });

  it('lists all observe programs', () => {
    const programs = listObservePrograms();
    expect(programs.length).toBe(6);
    expect(programs.map(p => p.name)).toEqual([
      'contradictory_sensors',
      'temporal_reasoning',
      'resource_pressure',
      'belief_revision',
      'cross_engine_sync',
      'auto',
    ]);
  });
});