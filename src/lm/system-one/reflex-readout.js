/**
 * Bounded reflex decision log (TODO24 Phase-B per-message attribution).
 * Reflexes record every decision they serve; consumers join by wall-clock
 * window (a message's span) instead of relying on the single last decision —
 * the kernel mints correlationIds inside agent.chat(), so the message span is
 * the honest join available without threading ids through the Focus cycle.
 */
import { BoundedRing } from '@senars/util/collections';
export class DecisionLog {
    #entries;
    constructor(cap = 32) {
        this.#entries = new BoundedRing(cap);
    }
    record(proposed, selected, at = Date.now()) {
        this.#entries.push({ proposed, selected, at });
    }
    /** Most recent decision, or undefined when nothing has been served. */
    get last() {
        return this.#entries.last();
    }
    /** Decisions served within `[at, ∞)` — a message's wall-clock span. */
    since(at) {
        return this.#entries.filter((d) => d.at >= at);
    }
}
/** Decision-log readouts every recording reflex exposes (TODO24 attribution). */
export class DecisionReadout {
    decisionLog = new DecisionLog();
    get lastDecision() {
        const d = this.decisionLog.last;
        return d ? { proposed: d.proposed, selected: d.selected } : undefined;
    }
    /** Decisions served within [at, ∞) — per-message join via wall-clock span. */
    decisionsSince(at) {
        return this.decisionLog.since(at);
    }
}
