/**
 * The live cycle's stage regions (TODO29.a A1).
 *
 * A stage region is `begin` … `end`, and nesting is what the property is about:
 * a producer's work opening inside `reason` is the cycle depending on a model,
 * whatever the trace says the work was called. The stage vocabulary itself lives
 * in `stages.ts`.
 */

import { BoundedRing } from '@senars/util';

import type { CycleStage } from './stages.js';

export type { CycleStage } from './stages.js';

export interface CycleStageEvent {
  readonly cycle: number;
  readonly stage: CycleStage;
  readonly phase: 'begin' | 'end';
  readonly at: number;
  /** The stimulus that drove the cycle, when the caller declared one. */
  readonly correlationId?: string;
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
  #correlationId?: string;

  /** Join every later region to one stimulus — set by `run()` for the call's duration. */
  setCorrelationId(correlationId?: string): void {
    this.#correlationId = correlationId;
  }

  begin(cycle: number, stage: CycleStage): void {
    this.open.push(stage);
    this.events.push(this.#record(cycle, stage, 'begin'));
  }

  end(cycle: number, stage: CycleStage): void {
    const at = this.open.lastIndexOf(stage);
    if (at >= 0) this.open.splice(at, 1);
    this.events.push(this.#record(cycle, stage, 'end'));
  }

  #record(cycle: number, stage: CycleStage, phase: 'begin' | 'end'): CycleStageEvent {
    return {
      cycle,
      stage,
      phase,
      at: Date.now(),
      ...(this.#correlationId ? { correlationId: this.#correlationId } : {}),
    };
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
