import type { CycleStageEvent } from '@senars/nar/proposal/cycle-trace.js';
import { summarizeRegions } from '@senars/nar/trace';
import { describe, expect, it } from 'vitest';

const region = (
  cycle: number,
  stage: CycleStageEvent['stage'],
  phase: CycleStageEvent['phase'],
  at: number
): CycleStageEvent => ({ cycle, stage, phase, at });

describe('summarizeRegions — timing as a projection over the trace', () => {
  it('pairs each end with the begin of the same region', () => {
    const summary = summarizeRegions([
      region(1, 'reason', 'begin', 10),
      region(1, 'reason', 'end', 40),
    ]);
    expect(summary.phases).toEqual([
      { region: 'reason', cycle: 1, startTime: 10, endTime: 40, durationMs: 30 },
    ]);
    expect(summary.totalDurationMs).toBe(30);
    expect(summary.byRegion.reason).toEqual({ count: 1, totalMs: 30, avgMs: 30 });
  });

  it('attributes nested regions to their own span, not to the enclosing one', () => {
    const summary = summarizeRegions([
      region(1, 'learn', 'begin', 0),
      region(1, 'rlfp.optimize', 'begin', 10),
      region(1, 'rlfp.optimize', 'end', 25),
      region(1, 'learn', 'end', 100),
    ]);
    expect(summary.byRegion).toEqual({
      'rlfp.optimize': { count: 1, totalMs: 15, avgMs: 15 },
      learn: { count: 1, totalMs: 100, avgMs: 100 },
    });
  });

  it('omits a region left open rather than measuring it to an arbitrary time', () => {
    const summary = summarizeRegions([
      region(1, 'reason', 'begin', 0),
      region(1, 'propose', 'begin', 5),
      region(1, 'propose', 'end', 9),
    ]);
    expect(summary.phases.map((p) => p.region)).toEqual(['propose']);
  });

  it('is empty for an empty record', () => {
    expect(summarizeRegions([])).toEqual({
      totalDurationMs: 0,
      phases: [],
      byRegion: {},
    });
  });
});
