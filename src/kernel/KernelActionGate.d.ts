import type { ActionGateInput, ActionGateOutput, GateOutcome } from '@senars/schemas/gate-io';
import type { AutonomyAuthority, AutonomyMode } from '@senars/schemas/governance';
import type { AutonomyModeChangedEvent, PolicyViolationEvent } from '@senars/schemas/cognitive-events';
import { SenarsError } from '@senars/errors';
import { KernelGate } from './gate-base';
/**
 * Typed NAL-veto error for callers that convert a gate veto result
 * (`authorized: false` + `vetoReason`) into an exception. The gate itself
 * reports vetoes via its typed result and a `policy.violation` event, never
 * by throwing.
 */
export declare class NALVetoError extends SenarsError {
    readonly vetoReason: string;
    readonly correlationId: string;
    constructor(vetoReason: string, correlationId: string);
}
export interface KernelActionGateConfig {
    autonomyMode: AutonomyMode;
    allowedOperations: ReadonlySet<string>;
}
export declare class KernelActionGate extends KernelGate<PolicyViolationEvent> {
    private autonomyLog;
    private autonomyMode;
    private allowedOperations;
    /**
     * NAL conclusions keyed by derivation id. Bounded at kernel-log capacity for
     * the same reason `autonomyLog` and `eventLog` are: derivation ids arrive on
     * every reasoning step and nothing retires them, so an unbounded map grew for
     * the lifetime of the process. A veto beyond the cap falls off, and the action
     * then faces the allow-list alone — the same post-expiry posture a dropped
     * gate-log entry leaves behind.
     */
    private nalDerivations;
    /** Per-scope autonomy modes + allowlists (game:<scopeId>:<action> operations). Additive. */
    private scopeModes;
    private scopeOperations;
    protected outcomeOf(output: unknown): GateOutcome;
    constructor(config?: Partial<KernelActionGateConfig>);
    setAutonomyMode(mode: AutonomyMode): void;
    getAutonomyMode(): AutonomyMode;
    requestModeChange(newMode: AutonomyMode, authorizedBy: AutonomyAuthority, correlationId?: any): {
        changed: boolean;
        reason?: string;
    };
    getAutonomyLog(): ReadonlyArray<AutonomyModeChangedEvent>;
    /** Re-seed the autonomy ring with a persisted mode change (CORE.19 C4.3). */
    restoreAutonomyEvent(event: AutonomyModeChangedEvent): void;
    /** Set autonomy mode for a named scope without touching the global mode (A3). */
    setScopeAutonomy(scopeId: string, mode: AutonomyMode): void;
    /** Scope autonomy mode (undefined when the scope is unknown to this gate). */
    getScopeAutonomy(scopeId: string): AutonomyMode | undefined;
    addScopedOperation(scopeId: string, operation: string): void;
    removeScope(scopeId: string): void;
    /** Parse 'game:<scopeId>:<action>' → {scopeId, action}; undefined when not namespaced. */
    static parseScopedOperation(operation: string): {
        scopeId: string;
        action: string;
    } | undefined;
    private authorizeScoped;
    registerNALDerivation(derivationId: string, conclusion: string, veto?: boolean): void;
    authorize(input: ActionGateInput): ActionGateOutput;
    private decideAuthorization;
    addAllowedOperation(operation: string): void;
    removeAllowedOperation(operation: string): void;
    clearEventLog(): void;
}
//# sourceMappingURL=KernelActionGate.d.ts.map