/**
 * Phase E (REFACTOR.todo2 §3/§8): pluggable arbitration for `Negotiator`.
 * `NalVetoArbitration` is the extracted default (byte-identical to the former
 * inline `decide()`); `WeightedQuorum` is the opt-in consensus alternative.
 */
var _a;
import { getOrInsert, incrementCount } from '@senars/util/collections';
import { LruCache } from '@senars/util/lru-cache';
import { expectedValue } from './Reflex';
const none = (arbitration) => ({
    action: null,
    actionExecuted: null,
    vetoedBy: null,
    confidence: 0,
    source: 'none',
    arbitration,
});
const bestOf = (proposals) => proposals.reduce((best, p) => (!best || expectedValue(p) > expectedValue(best) ? p : best), null);
/** Extracted Negotiator default: reflex best-of with the NAL trap veto (Bench-15). */
export class NalVetoArbitration {
    /**
     * P3 (TODO20): memoized `isVetoingAction` keyed by the full predicate input
     * (action, truth, proposal) — pure function of the key, so entries can never
     * go stale; bounded and cleared wholesale past the cap.
     */
    static #VETO_MEMO_CAP = 10_000;
    #vetoMemo = new LruCache(_a.#VETO_MEMO_CAP);
    #nalVetoThreshold;
    #reflexThreshold;
    constructor(options = {}) {
        this.#nalVetoThreshold = options.nalVetoThreshold ?? 0.8;
        this.#reflexThreshold = options.reflexThreshold ?? 0.3;
    }
    decide(reflexProposals, nalDerivations) {
        if (reflexProposals.length === 0)
            return none('nal-veto');
        const bestReflex = bestOf(reflexProposals);
        if (expectedValue(bestReflex) < this.#reflexThreshold) {
            return { ...none('nal-veto'), vetoedBy: 'below-threshold' };
        }
        // Veto (Bench-15): NAL derives the best action leads to bad outcome (low
        // frequency = trap). The veto blocks the trap action; if another legal
        // proposal remains, the best one acts instead — the veto prevents the
        // known trap without paralyzing the agent. Otherwise the tick yields.
        const trap = nalDerivations.find((d) => this.#isVetoingAction(d, bestReflex.action));
        if (!trap) {
            return {
                action: bestReflex.action,
                actionExecuted: bestReflex.action,
                vetoedBy: null,
                confidence: bestReflex.confidence,
                source: 'reflex',
                arbitration: 'nal-veto',
            };
        }
        const fallback = bestOf(reflexProposals.filter((p) => !nalDerivations.some((d) => this.#isVetoingAction(d, p.action))));
        return {
            action: bestReflex.action,
            actionExecuted: fallback?.action ?? null,
            vetoedBy: `nal-${trap.source}`,
            confidence: fallback?.confidence ?? trap.truth.c,
            source: 'nal',
            arbitration: 'nal-veto',
        };
    }
    /** Memo size surface (Negotiator.memoStats parity, P3/TODO20). */
    memoSize() {
        return this.#vetoMemo.size();
    }
    #isVetoingAction(derivation, proposedAction) {
        const key = `${derivation.action}|${derivation.truth.f}|${derivation.truth.c}|${proposedAction}`;
        return getOrInsert(this.#vetoMemo, key, () => derivation.action === proposedAction &&
            derivation.truth.f < 0.3 &&
            derivation.truth.c >= this.#nalVetoThreshold);
    }
}
_a = NalVetoArbitration;
/**
 * Consensus arbitration (opt-in): NAL derivations vote on proposed actions
 * instead of hard-vetoing — supporting derivations (f ≥ 0.5) add weight,
 * opposing ones (f < 0.3 with high confidence) subtract; the top quorum score
 * above the floor acts.
 */
export class WeightedQuorum {
    #floor;
    #reflexThreshold;
    #vetoThreshold;
    constructor(options = {}) {
        this.#reflexThreshold = options.reflexThreshold ?? 0.3;
        this.#floor = options.quorumFloor ?? 0;
        this.#vetoThreshold = options.nalVetoThreshold ?? 0.8;
    }
    decide(reflexProposals, nalDerivations) {
        if (reflexProposals.length === 0)
            return none('weighted-quorum');
        const quorum = new Map();
        for (const p of reflexProposals) {
            incrementCount(quorum, p.action, expectedValue(p));
        }
        for (const d of nalDerivations) {
            if (!quorum.has(d.action))
                continue;
            const vote = d.truth.f >= 0.5
                ? d.truth.c
                : d.truth.f < 0.3 && d.truth.c >= this.#vetoThreshold
                    ? -d.truth.c
                    : 0;
            incrementCount(quorum, d.action, vote);
        }
        const winner = [...quorum.entries()]
            .filter(([action, score]) => score >= this.#floor)
            .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
        if (!winner)
            return none('weighted-quorum');
        const best = bestOf(reflexProposals.filter((p) => p.action === winner[0]));
        if (!best || expectedValue(best) < this.#reflexThreshold)
            return none('weighted-quorum');
        return {
            action: winner[0],
            actionExecuted: winner[0],
            vetoedBy: null,
            confidence: best.confidence,
            source: 'reflex',
            arbitration: 'weighted-quorum',
        };
    }
}
