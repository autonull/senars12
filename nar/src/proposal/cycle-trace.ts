/**
 * The live cycle's stage vocabulary (TODO29.a A1).
 *
 * `nar/src/tick/` declared this vocabulary and nothing in production called it:
 * the live cycle timed free-form `PhaseTimer` categories, so "no `propose` work
 * inside a `reason` stage" had no trace to be asserted against (§0.8 finding 1).
 * The stage names are therefore `TickHook`'s keys — one vocabulary, not two — and
 * what this module adds is the *record* of which stage was open when.
 *
 * A stage region is `begin` … `end`, and nesting is what the property is about:
 * a producer's work opening inside `reason` is the cycle depending on a model,
 * whatever the trace says the work was called.
 */

import { BoundedRing } from '@senars/util';
import type { TickHooks } from '../tick/tick.js';

export type CycleStage = keyof TickHooks;

/** Every stage a cycle may run, in the order a cycle runs them. */
export const CYCLE_STAGES: readonly CycleStage[] = [
  'authorize',
  'perceive',
  'attend',
  'reason',
  'propose',
  'learn',
];

export interface CycleStageEvent {
  readonly cycle: number;
  readonly stage: CycleStage;
  readonly phase: 'begin' | 'end';
  readonly at: number;
}

export interface StageOverlap {
  readonly cycle: number;
  readonly outer: CycleStage;
  readonly inner: CycleStage;
}

const DEPTH = 512;

/** Bounded record of stage regions, oldest evicted first. */
export class CycleTrace {
  private readonly events = new BoundedRing<CycleStageEvent>(DEPTH);
  private readonly open: CycleStage[] = [];

  begin(cycle: number, stage: CycleStage): void {
    this.open.push(stage);
    this.events.push({ cycle, stage, phase: 'begin', at: Date.now() });
  }

  end(cycle: number, stage: CycleStage): void {
    const at = this.open.lastIndexOf(stage);
    if (at >= 0) this.open.splice(at, 1);
    this.events.push({ cycle, stage, phase: 'end', at: Date.now() });
  }

  /** The deepest stage currently open, if any. */
  current(): CycleStage | undefined {
    return this.open[this.open.length - 1];
  }

  regions(): readonly CycleStageEvent[] {
    return this.events.toArray();
  }
}

/**
 * Stage regions that opened inside another — the shape of a cycle that reached a
 * model mid-thought. Pure, so the gate, the tests and a reader of a trace all
 * agree on what "nested" means.
 */
export const findStageOverlaps = (
  events: readonly CycleStageEvent[]
): readonly StageOverlap[] => {
  const overlaps: StageOverlap[] = [];
  const open: CycleStage[] = [];
  for (const event of events) {
    if (event.phase === 'begin') {
      const outer = open[open.length - 1];
      if (outer && outer !== event.stage) overlaps.push({ cycle: event.cycle, outer, inner: event.stage });
      open.push(event.stage);
    } else {
      const at = open.lastIndexOf(event.stage);
      if (at >= 0) open.splice(at, 1);
    }
  }
  return overlaps;
};

/**
 * The one property the trace exists to carry: model-backed proposal work is
 * staged and pumped at a boundary, never opened inside the reasoning stage.
 */
export const findInCycleProposals = (
  events: readonly CycleStageEvent[]
): readonly StageOverlap[] =>
  findStageOverlaps(events).filter(
    (overlap) => overlap.outer === 'reason' && overlap.inner === 'propose'
  );
