import { v4 as uuidv4 } from 'uuid';
import type {
    ActionGateInput,
    ActionGateOutput,
    PolicyViolationEvent,
    CognitiveEvent,
    AutonomyMode,
} from '@senars/kernel/schemas';
import { validateCognitiveEvent } from '@senars/kernel/schemas';

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
    }
}