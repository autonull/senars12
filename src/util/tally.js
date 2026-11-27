/**
 * One tally of attempts: how many there were, how many succeeded, how long they
 * took.
 *
 * Five sites in the tree answered "did that work, and how fast" with counters of
 * their own — the LM per-model stats, the per-tool feedback, the per-rule stats,
 * the rule graph's latency, and the metacognitive monitor's performance history.
 * Two spelled the success rate `successfulCalls / totalCalls`, one kept a running
 * mean of durations, one an EWMA, and one recorded no count at all; two carried
 * columns nothing ever read. So the same question had four answers, none of them
 * comparable with another, and each tally lived in an unbounded `Map` keyed by
 * whatever the caller happened to hold.
 *
 * `CallTally` is the shape and {@link recordCall} is the update rule.
 * {@link CallTallySeries} is the bounded map of them, so a caller keyed by rule
 * id, tool name or model id inherits a capacity instead of writing its own.
 */
import { BoundedMap } from './bounded-map';
import { systemClock } from './clock';
import { getOrInsert } from './collections';
/** The zeroed counters — the state before the first recorded attempt. */
export const createCallTally = () => ({
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    totalDuration: 0,
    averageDuration: 0,
    successRate: 0,
    lastCalled: 0,
});
/** Fold one attempt into `tally`, in place, and hand it back for chaining. */
export const recordCall = (tally, success, durationMs, at = systemClock()) => {
    tally.totalCalls++;
    if (success)
        tally.successfulCalls++;
    else
        tally.failedCalls++;
    tally.totalDuration += durationMs;
    tally.averageDuration = tally.totalDuration / tally.totalCalls;
    tally.successRate = tally.successfulCalls / tally.totalCalls;
    tally.lastCalled = at;
    return tally;
};
/**
 * A capacity-bounded map of per-key tallies.
 *
 * Least-recently-used by default, so a hot key keeps its history while a stream
 * of one-shot keys cannot grow the map past its capacity. A site that wants its
 * history to age out rather than be evicted passes `ttlMs`; one that wants the
 * coldest key gone first passes `eviction`.
 *
 * A {@link BoundedMap} rather than one that holds one: the read surface — `get`,
 * `has`, `keys`, `values`, `entries`, iteration, `size`, `pressure`, `clear` — is
 * the map's, and re-declaring it here meant twelve members that could answer a
 * question the map had already changed the answer to.
 */
export class CallTallySeries extends BoundedMap {
    #now;
    #create;
    constructor(options) {
        super(options);
        this.#now = options.now ?? systemClock;
        this.#create = options.create;
    }
    /** Fold one attempt into `key`'s tally, minting it on first sight. */
    record(key, success, durationMs) {
        return recordCall(this.getOrInsert(key), success, durationMs, this.#now());
    }
    /**
     * The live tally, minted on first sight — the series' answer to util's
     * `getOrInsert`, for a caller folding in facts {@link record} does not model.
     * The LM accounting keeps token spend beside the call counters, so it needs the
     * record without wanting another attempt counted.
     */
    getOrInsert(key) {
        return getOrInsert(this, key, () => this.#create(key));
    }
    /** Forget one key, or all of them. */
    reset(key) {
        if (key === undefined)
            this.clear();
        else
            this.delete(key);
    }
}
