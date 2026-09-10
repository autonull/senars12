import { v4 as uuidv4 } from 'uuid';
import type {
    ActionGateInput,
    ActionGateOutput,
    PolicyViolationEvent,
    AutonomyModeChangedEvent,
    AutonomyMode,
} from '@senars/kernel/schemas';
import { validateCognitiveEvent, AutonomyModeChangedEventSchema } from '@senars/kernel/schemas';

const MODE_ORDER: AutonomyMode[] = ['observe-only', 'propose-only', 'sandbox-execute', 'low-risk-auto-merge', 'human-approved-production'];

const LEGAL_TRANSITIONS: Record<AutonomyMode, AutonomyMode[]> = {
    'observe-only': ['propose-only'],
    'propose-only': ['observe-only', 'sandbox-execute'],
    'sandbox-execute': ['propose-only', 'low-risk-auto-merge'],
    'low-risk-auto-merge': ['sandbox-execute', 'human-approved-production'],
    'human-approved-production': ['low-risk-auto-merge'],
};

export type AutonomyAuthority = 'system' | 'human' | 'external-governance';

export class NALVetoError extends Error {
    public readonly vetoReason: string;
    public readonly correlationId: string;

    constructor(vetoReason: string, correlationId: string) {
        super(`NAL veto: ${vetoReason}`);
        this.name = 'NALVetoError';
        this.vetoReason = vetoReason;
        this.correlationId = correlationId;
    }
}

export interface KernelActionGateConfig {
    autonomyMode: AutonomyMode;
    allowedOperations: ReadonlySet<string>;
}

const DEFAULT_AUTONOMY_MODE: AutonomyMode = 'observe-only';
const DEFAULT_ALLOWED_OPS = new Set<string>();

export class KernelActionGate {
    private eventLog: PolicyViolationEvent[] = [];
    private autonomyLog: AutonomyModeChangedEvent[] = [];
    private autonomyMode: AutonomyMode;
    private allowedOperations: ReadonlySet<string>;
    private nalDerivations: Map<string, { conclusion: string; veto: boolean }> = new Map();

    constructor(config?: Partial<KernelActionGateConfig>) {
        this.autonomyMode = config?.autonomyMode ?? DEFAULT_AUTONOMY_MODE;
        this.allowedOperations = config?.allowedOperations ?? DEFAULT_ALLOWED_OPS;
    }

    setAutonomyMode(mode: AutonomyMode): void {
        this.autonomyMode = mode;
    }

    getAutonomyMode(): AutonomyMode {
        return this.autonomyMode;
    }

    requestModeChange(newMode: AutonomyMode, authorizedBy: AutonomyAuthority, correlationId = uuidv4()): { changed: boolean; reason?: string } {
        const prev = this.autonomyMode;
        if (prev === newMode) return { changed: true };
        if (!LEGAL_TRANSITIONS[prev].includes(newMode)) return { changed: false, reason: `Illegal transition ${prev} -> ${newMode}` };
        const upgrading = MODE_ORDER.indexOf(newMode) > MODE_ORDER.indexOf(prev);
        const beyondSandbox = MODE_ORDER.indexOf(newMode) > MODE_ORDER.indexOf('sandbox-execute');
        if (upgrading && beyondSandbox && authorizedBy === 'system') return { changed: false, reason: 'Escalation beyond sandbox-execute requires human or external-governance approval' };
        this.autonomyMode = newMode;
        const event: AutonomyModeChangedEvent = AutonomyModeChangedEventSchema.parse({ type: 'autonomy.mode.changed', engine: 'kernel', timestamp: Date.now(), correlationId, payload: { previousMode: prev, newMode, authorizedBy } });
        this.autonomyLog.push(event);
        return { changed: true };
    }

    getAutonomyLog(): ReadonlyArray<AutonomyModeChangedEvent> {
        return this.autonomyLog;
    }

    registerNALDerivation(derivationId: string, conclusion: string, veto: boolean = false): void {
        this.nalDerivations.set(derivationId, { conclusion, veto });
    }

    authorize(input: ActionGateInput): ActionGateOutput {
        const correlationId = input.correlationId ?? uuidv4();

        if (this.autonomyMode === 'observe-only' || this.autonomyMode === 'propose-only') {
            const event: PolicyViolationEvent = {
                type: 'policy.violation',
                engine: 'kernel',
                timestamp: Date.now(),
                correlationId,
                payload: {
                    policyId: 'autonomy-mode',
                    violationType: 'unauthorized-tool',
                    detail: `Action not permitted in ${this.autonomyMode} mode`,
                    severity: 'block',
                },
            };
            validateCognitiveEvent(event);
            this.eventLog.push(event);

            return {
                authorized: false,
                vetoReason: `Autonomy mode ${this.autonomyMode} does not permit tool execution`,
                requiredApprovals: ['human-approval'],
            };
        }

        if (input.nalDerivationId && this.nalDerivations.has(input.nalDerivationId)) {
            const derivation = this.nalDerivations.get(input.nalDerivationId)!;
            if (derivation.veto) {
                const event: PolicyViolationEvent = {
                    type: 'policy.violation',
                    engine: 'kernel',
                    timestamp: Date.now(),
                    correlationId,
                    payload: {
                        policyId: 'nal-veto',
                        violationType: 'unauthorized-tool',
                        detail: `NAL derivation ${input.nalDerivationId} vetoes action: ${derivation.conclusion}`,
                        severity: 'block',
                    },
                };
                validateCognitiveEvent(event);
                this.eventLog.push(event);

                return {
                    authorized: false,
                    vetoReason: `NAL veto: ${derivation.conclusion}`,
                };
            }
        }

        if (!this.allowedOperations.has(input.operation)) {
            const event: PolicyViolationEvent = {
                type: 'policy.violation',
                engine: 'kernel',
                timestamp: Date.now(),
                correlationId,
                payload: {
                    policyId: 'allowed-operations',
                    violationType: 'unauthorized-tool',
                    detail: `Operation '${input.operation}' not in allowed operations list`,
                    severity: 'block',
                },
            };
            validateCognitiveEvent(event);
            this.eventLog.push(event);

            return {
                authorized: false,
                vetoReason: `Operation '${input.operation}' not permitted`,
                requiredApprovals: ['human-approval'],
            };
        }

        const toolCallId = uuidv4();
        return {
            authorized: true,
            toolCallId,
        };
    }

    addAllowedOperation(operation: string): void {
        const newSet = new Set(this.allowedOperations);
        newSet.add(operation);
        this.allowedOperations = newSet;
    }

    removeAllowedOperation(operation: string): void {
        const newSet = new Set(this.allowedOperations);
        newSet.delete(operation);
        this.allowedOperations = newSet;
    }

    getEventLog(): ReadonlyArray<PolicyViolationEvent> {
        return this.eventLog;
    }

    clearEventLog(): void {
        this.eventLog = [];
        this.autonomyLog = [];
    }
}