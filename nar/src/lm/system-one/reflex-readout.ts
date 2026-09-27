/**
 * Bounded reflex decision log (TODO24 Phase-B per-message attribution).
 * Reflexes record every decision they serve; consumers join by wall-clock
 * window (a message's span) instead of relying on the single last decision —
 * the kernel mints correlationIds inside agent.chat(), so the message span is
 * the honest join available without threading ids through the Focus cycle.
 */
import { BoundedRing } from '../../utils/collections.js';

export interface ReflexDecision {
  proposed: readonly string[];
  selected: string;
  at: number;
}

export class DecisionLog {
  readonly #entries: BoundedRing<ReflexDecision>;

  constructor(cap = 32) {
    this.#entries = new BoundedRing(cap);
  }

  record(proposed: readonly string[], selected: string, at = Date.now()): void {
    this.#entries.push({ proposed, selected, at });
  }

  /** Most recent decision, or undefined when nothing has been served. */
  get last(): ReflexDecision | undefined {
    return this.#entries.last();
  }

  /** Decisions served within `[at, ∞)` — a message's wall-clock span. */
  since(at: number): ReflexDecision[] {
    return this.#entries.filter((d) => d.at >= at);
  }
}

/** Decision-log readouts every recording reflex exposes (TODO24 attribution). */
export abstract class DecisionReadout {
  protected readonly decisionLog = new DecisionLog();

  get lastDecision(): { proposed: readonly string[]; selected: string } | undefined {
    const d = this.decisionLog.last;
    return d ? { proposed: d.proposed, selected: d.selected } : undefined;
  }

  /** Decisions served within [at, ∞) — per-message join via wall-clock span. */
  decisionsSince(at: number): readonly ReflexDecision[] {
    return this.decisionLog.since(at);
  }
}
