import { AutonomyModeChangedEventSchema, mintCognitiveEvent, } from '@senars/schemas/cognitive-events';
import { AutonomyModeSchema, permitsExecution } from '@senars/schemas/governance';
import { addToSet, pushCapped } from '@senars/util/collections';
import { BoundedMap } from '@senars/util/bounded-map';
import { makeId } from '@senars/util/id';
import { SenarsError } from '@senars/errors';
import { GATE_LOG_CAPACITY } from './event-ring';
import { KernelGate, projectOutcome } from './gate-base';
const MODE_ORDER = AutonomyModeSchema.options;
const LEGAL_TRANSITIONS = {
    'observe-only': ['propose-only'],
    'propose-only': ['observe-only', 'sandbox-execute'],
    'sandbox-execute': ['propose-only', 'low-risk-auto-merge'],
    'low-risk-auto-merge': ['sandbox-execute', 'human-approved-production'],
    'human-approved-production': ['low-risk-auto-merge'],
};
/**
 * Typed NAL-veto error for callers that convert a gate veto result
 * (`authorized: false` + `vetoReason`) into an exception. The gate itself
 * reports vetoes via its typed result and a `policy.violation` event, never
 * by throwing.
 */
export class NALVetoError extends SenarsError {
    vetoReason;
    correlationId;
    constructor(vetoReason, correlationId) {
        super(`NAL veto: ${vetoReason}`, 'GATE_DENIED', { gate: 'action', vetoReason, correlationId });
        this.name = 'NALVetoError';
        this.vetoReason = vetoReason;
        this.correlationId = correlationId;
    }
}
const DEFAULT_AUTONOMY_MODE = 'observe-only';
const DEFAULT_ALLOWED_OPS = new Set();
/** The approval a refusal always asks for — one value, so no refusal can omit it. */
const HUMAN_APPROVAL = ['human-approval'];
/**
 * A refusal, with its reason. Five sites in this gate each wrote the same
 * three-field literal, and one of them — the NAL veto — forgot
 * `requiredApprovals`, so a vetoed action named no approval and the caller had
 * to infer one. The literal and the omission go together.
 */
const veto = (vetoReason) => ({
    authorized: false,
    vetoReason,
    requiredApprovals: HUMAN_APPROVAL,
});
export class KernelActionGate extends KernelGate {
    autonomyLog = [];
    autonomyMode;
    allowedOperations;
    /**
     * NAL conclusions keyed by derivation id. Bounded at kernel-log capacity for
     * the same reason `autonomyLog` and `eventLog` are: derivation ids arrive on
     * every reasoning step and nothing retires them, so an unbounded map grew for
     * the lifetime of the process. A veto beyond the cap falls off, and the action
     * then faces the allow-list alone — the same post-expiry posture a dropped
     * gate-log entry leaves behind.
     */
    nalDerivations;
    /** Per-scope autonomy modes + allowlists (game:<scopeId>:<action> operations). Additive. */
    scopeModes = new Map();
    scopeOperations = new Map();
    outcomeOf(output) {
        return projectOutcome(output, (o) => o.authorized, (o) => o.vetoReason);
    }
    constructor(config) {
        super();
        this.autonomyMode = config?.autonomyMode ?? DEFAULT_AUTONOMY_MODE;
        this.allowedOperations = new Set(config?.allowedOperations ?? DEFAULT_ALLOWED_OPS);
        this.nalDerivations = new BoundedMap({ maxSize: GATE_LOG_CAPACITY });
    }
    setAutonomyMode(mode) {
        this.autonomyMode = mode;
    }
    getAutonomyMode() {
        return this.autonomyMode;
    }
    requestModeChange(newMode, authorizedBy, correlationId = makeId()) {
        const prev = this.autonomyMode;
        if (prev === newMode)
            return { changed: true };
        if (!LEGAL_TRANSITIONS[prev].includes(newMode))
            return { changed: false, reason: `Illegal transition ${prev} -> ${newMode}` };
        const upgrading = MODE_ORDER.indexOf(newMode) > MODE_ORDER.indexOf(prev);
        const beyondSandbox = MODE_ORDER.indexOf(newMode) > MODE_ORDER.indexOf('sandbox-execute');
        if (upgrading && beyondSandbox && authorizedBy === 'system')
            return {
                changed: false,
                reason: 'Escalation beyond sandbox-execute requires human or external-governance approval',
            };
        this.autonomyMode = newMode;
        const event = AutonomyModeChangedEventSchema.parse(mintCognitiveEvent('autonomy.mode.changed', {
            engine: 'kernel',
            correlationId,
            payload: { previousMode: prev, newMode, authorizedBy },
        }));
        pushCapped(this.autonomyLog, event, GATE_LOG_CAPACITY);
        return { changed: true };
    }
    getAutonomyLog() {
        return this.autonomyLog;
    }
    /** Re-seed the autonomy ring with a persisted mode change (CORE.19 C4.3). */
    restoreAutonomyEvent(event) {
        pushCapped(this.autonomyLog, event, GATE_LOG_CAPACITY);
    }
    /** Set autonomy mode for a named scope without touching the global mode (A3). */
    setScopeAutonomy(scopeId, mode) {
        this.scopeModes.set(scopeId, mode);
    }
    /** Scope autonomy mode (undefined when the scope is unknown to this gate). */
    getScopeAutonomy(scopeId) {
        return this.scopeModes.get(scopeId);
    }
    addScopedOperation(scopeId, operation) {
        addToSet(this.scopeOperations, scopeId, operation);
    }
    removeScope(scopeId) {
        this.scopeModes.delete(scopeId);
        this.scopeOperations.delete(scopeId);
    }
    /** Parse 'game:<scopeId>:<action>' → {scopeId, action}; undefined when not namespaced. */
    static parseScopedOperation(operation) {
        if (!operation.startsWith('game:'))
            return undefined;
        const rest = operation.slice('game:'.length);
        const sep = rest.indexOf(':');
        if (sep <= 0)
            return undefined;
        return { scopeId: rest.slice(0, sep), action: rest.slice(sep + 1) };
    }
    authorizeScoped(scopeId, action) {
        const mode = this.scopeModes.get(scopeId);
        if (mode === undefined)
            return veto(`Unknown scope ${scopeId}`);
        if (!permitsExecution(mode))
            return veto(`Autonomy mode ${mode} does not permit execution (scope ${scopeId})`);
        if (!this.scopeOperations.get(scopeId)?.has(action))
            return veto(`Operation '${action}' not permitted in scope ${scopeId}`);
        return { authorized: true, toolCallId: makeId() };
    }
    registerNALDerivation(derivationId, conclusion, veto = false) {
        this.nalDerivations.set(derivationId, { conclusion, veto });
    }
    authorize(input) {
        return this.decideAndRecord('action', input.operation, input, (inp, correlation) => this.decideAuthorization(inp, correlation), (inp) => inp.correlationId);
    }
    decideAuthorization(input, correlation) {
        const scoped = KernelActionGate.parseScopedOperation(input.operation);
        if (scoped)
            return this.authorizeScoped(scoped.scopeId, scoped.action);
        if (!permitsExecution(this.autonomyMode)) {
            this.recordPolicyViolation({
                policyId: 'autonomy-mode',
                violationType: 'unauthorized-tool',
                detail: `Action not permitted in ${this.autonomyMode} mode`,
                correlationId: correlation(),
            });
            return veto(`Autonomy mode ${this.autonomyMode} does not permit tool execution`);
        }
        const derivation = input.nalDerivationId
            ? this.nalDerivations.get(input.nalDerivationId)
            : undefined;
        if (derivation?.veto) {
            this.recordPolicyViolation({
                policyId: 'nal-veto',
                violationType: 'unauthorized-tool',
                detail: `NAL derivation ${input.nalDerivationId} vetoes action: ${derivation.conclusion}`,
                correlationId: correlation(),
            });
            return veto(`NAL veto: ${derivation.conclusion}`);
        }
        if (!this.allowedOperations.has(input.operation)) {
            this.recordPolicyViolation({
                policyId: 'allowed-operations',
                violationType: 'unauthorized-tool',
                detail: `Operation '${input.operation}' not in allowed operations list`,
                correlationId: correlation(),
            });
            return veto(`Operation '${input.operation}' not permitted`);
        }
        const toolCallId = makeId();
        return {
            authorized: true,
            toolCallId,
        };
    }
    addAllowedOperation(operation) {
        this.allowedOperations.add(operation);
    }
    removeAllowedOperation(operation) {
        this.allowedOperations.delete(operation);
    }
    clearEventLog() {
        super.clearEventLog();
        this.autonomyLog = [];
    }
}
