/**
 * Bounded reflex decision log (TODO24 Phase-B per-message attribution).
 * Reflexes record every decision they serve; consumers join by wall-clock
 * window (a message's span) instead of relying on the single last decision —
 * the kernel mints correlationIds inside agent.chat(), so the message span is
 * the honest join available without threading ids through the Focus cycle.
 */
export interface ReflexDecision {
  proposed: readonly string[];
  selected: string;
  at: number;
}

export class DecisionLog {
  #entries: ReflexDecision[] = [];

  constructor(private readonly cap = 32) {}

  record(proposed: readonly string[], selected: string, at = Date.now()): void {
    this.#entries.push({ proposed, selected, at });
    if (this.#entries.length > this.cap) this.#entries.shift();
  }

  /** Most recent decision, or undefined when nothing has been served. */
  get last(): ReflexDecision | undefined {
    return this.#entries.at(-1);
  }

  /** Decisions served within `[at, ∞)` — a message's wall-clock span. */
  since(at: number): ReflexDecision[] {
    return this.#entries.filter((d) => d.at >= at);
  }
}
