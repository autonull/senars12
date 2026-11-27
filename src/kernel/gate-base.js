import { mintCognitiveEvent, validateCognitiveEvent } from '@senars/schemas/cognitive-events';
import { makeId } from '@senars/util/id';
import { gateLog } from './event-ring';
import { recordGateDecision } from '../telemetry/index';
/**
 * Read one gate's own output as the single outcome vocabulary. Each gate names
 * its grant flag and refusal reason for its own domain — `admitted` /
 * `rejectionReason`, `authorized` / `vetoReason`, `granted` / `terminationReason`
 * — because those names are part of that gate's wire contract. The base class
 * needs only the *decision*, so each gate projects its output once, here, with
 * the accessors checked against the declared type rather than guessed at runtime.
 */
export const projectOutcome = (output, granted, reason) => {
    const typed = output;
    return { granted: granted(typed), reason: reason(typed) };
};
/**
 * Shared skeleton for the four kernel gates: one bounded event ring, one
 * correlation-id mint, the one decision funnel, and the log accessors every gate
 * exposes.
 */
export class KernelGate {
    eventLog = gateLog();
    /** Validate then append to the gate's bounded log — every gate event goes through one funnel. */
    emitEvent(event) {
        validateCognitiveEvent(event);
        this.eventLog.push(event);
    }
    /**
     * Mint and record a `policy.violation`. On the base rather than beside the
     * ring so a gate states *that* it violated a policy and this class owns how
     * the event is built and validated — the three gates that denied a request
     * each spelled those two steps themselves.
     */
    recordPolicyViolation(input) {
        const event = mintCognitiveEvent('policy.violation', {
            engine: 'kernel',
            correlationId: input.correlationId,
            payload: {
                policyId: input.policyId,
                violationType: input.violationType,
                detail: input.detail,
                severity: input.severity ?? 'block',
            },
        });
        this.emitEvent(event);
        return event;
    }
    /**
     * Unified decision funnel: supplies a correlation id, invokes the decision
     * function, meters it as one outcome, and returns the gate's own output
     * unchanged. Subclasses implement `decide` with their specific logic.
     *
     * `decide` is handed `correlation` as a thunk, not a string, because most gates only
     * need an id on the refusal branch and a budget charge is one candidate rule. The
     * thunk memoizes, so a decision that asks and the span that records it share one id.
     */
    decideAndRecord(gateName, operation, input, decide, getCorrelationId) {
        let correlationId = getCorrelationId(input);
        const correlation = () => (correlationId ??= makeId());
        const output = decide(input, correlation);
        recordGateDecision(gateName, operation, this.outcomeOf(output), correlation);
        return output;
    }
    getEventLog() {
        return this.eventLog.toArray();
    }
    /**
     * Re-seed the ring with a persisted event (CORE.19 C4.3). The event was
     * schema-validated when the ledger read it back, so it is pushed as-is: a
     * restore is a replay of a past decision, not a second one.
     */
    restoreEvent(event) {
        this.eventLog.push(event);
    }
    clearEventLog() {
        this.eventLog.clear();
    }
}
