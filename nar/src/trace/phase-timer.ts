/**
 * Timing as a projection over the cycle trace (TODO33 §5.P2.5).
 *
 * There is one clock. `PhaseTimer` used to keep a second one — its own stack, its
 * own `begin`/`end` — and `end()` popped blindly, so an unbalanced pair
 * mis-attributed a span while the trace's name-matched record stayed correct.
 * There is nothing to time here that the trace did not already record; these are
 * pure functions over `CycleTrace.regions()`.
 */

import { pct, removeBy, weightedMean } from '@senars/util';
import type { CycleStageEvent, TraceRegion } from '../proposal/cycle-trace.js';

export interface PhaseEntry {
  readonly region: TraceRegion;
  readonly cycle: number;
  readonly startTime: number;
  readonly endTime: number;
  readonly durationMs: number;
  readonly correlationId?: string;
}

export interface PhaseTimerSummary {
  readonly totalDurationMs: number;
  readonly phases: readonly PhaseEntry[];
  readonly byRegion: Record<string, { count: number; totalMs: number; avgMs: number }>;
}

/**
 * Pair each region's `end` with the innermost open region of the same name, the
 * way the trace closes them. A region still open at the end of the record — the
 * process died, or the window evicted its `end` — is omitted rather than
 * measured to an arbitrary timestamp.
 */
export const summarizeRegions = (regions: readonly CycleStageEvent[]): PhaseTimerSummary => {
  const open: CycleStageEvent[] = [];
  const phases: PhaseEntry[] = [];

  for (const event of regions) {
    if (event.phase === 'begin') {
      open.push(event);
      continue;
    }
    const begin = removeBy(open, (b) => b.stage === event.stage && b.cycle === event.cycle);
    if (!begin) continue;
    phases.push({
      region: event.stage,
      cycle: event.cycle,
      startTime: begin.at,
      endTime: event.at,
      durationMs: event.at - begin.at,
      ...(begin.correlationId ? { correlationId: begin.correlationId } : {}),
    });
  }

  const byRegion: Record<string, { count: number; totalMs: number; avgMs: number }> = {};
  for (const phase of phases) {
    const bucket = byRegion[phase.region] ?? { count: 0, totalMs: 0, avgMs: 0 };
    byRegion[phase.region] = bucket;
    bucket.totalMs += phase.durationMs;
    bucket.avgMs = weightedMean(bucket.avgMs, bucket.count, phase.durationMs);
    bucket.count++;
  }

  const totalDurationMs =
    phases.length > 0
      ? Math.max(...phases.map((p) => p.endTime)) - Math.min(...phases.map((p) => p.startTime))
      : 0;

  return { totalDurationMs, phases, byRegion };
};

export const formatFlameChart = (summary: PhaseTimerSummary): string => {
  const lines: string[] = [`=== Temporal Trace (${summary.totalDurationMs}ms total) ===`, ''];
  for (const phase of summary.phases) {
    const bar = '#'.repeat(Math.max(1, Math.round(phase.durationMs / 10)));
    const share = pct(phase.durationMs / Math.max(1, summary.totalDurationMs));
    lines.push(
      ` [${phase.region.padEnd(20)}] cycle ${phase.cycle} ${String(phase.durationMs).padStart(6)}ms (${share}) ${bar}`
    );
  }
  if (Object.keys(summary.byRegion).length > 0) {
    lines.push('');
    lines.push('By Region:');
    for (const [region, stats] of Object.entries(summary.byRegion)) {
      const share = pct(stats.totalMs / Math.max(1, summary.totalDurationMs));
      lines.push(
        ` ${region.padEnd(20)} ${stats.count} calls, ${stats.totalMs}ms total (${share}), avg ${Math.round(stats.avgMs)}ms`
      );
    }
  }
  return lines.join('\n');
};
