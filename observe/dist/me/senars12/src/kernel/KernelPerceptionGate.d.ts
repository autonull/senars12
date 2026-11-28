import type { ShadowValidationDropEvent, TaskAdmittedEvent } from '@senars/schemas/cognitive-events';
import type { GateOutcome, PerceptionGateInput, PerceptionGateOutput } from '@senars/schemas/gate-io';
import type { FormalizationBatch } from '@senars/schemas/formalization';
import type { Budget } from '@senars/schemas/common';
import type { SourceQuality } from '@senars/schemas/truth';
import type { TruthLike } from '@senars/types/truth';
import type { TaskTypeName, Term } from '../terms';
import { KernelGate } from './gate-base';
import type { IngressJudge } from './ingress';
import type { SourceReputation } from './source-reputation';
export interface KernelPerceptionGateConfig {
    defaultBudget: Budget;
    systemOne?: {
        enabled: boolean;
        /** X2 (TODO20): injected ingress judge — kernel never imports proposer internals. */
        judge?: IngressJudge;
        /**
         * The bound on the judge. A judgment that misses it takes the same
         * fail-closed path a fault takes: judging an untrusted observation is
         * gating, and degrading to unjudged admission on expiry would bypass the
         * very veto the judge exists to apply (TODO29.a §5.1 step 7).
         */
        judgeTimeoutMs?: number;
    };
    /** Phase E (REFACTOR.todo1): optional source-reputation ceiling (trust-not-truth). */
    reputation?: SourceReputation;
}
export declare class KernelPerceptionGate extends KernelGate {
    private config;
    private judge;
    /** D23: optional DriveManager hook — ambiguity stimulates curiosity. */
    private driveManager;
    protected outcomeOf(output: unknown): GateOutcome;
    /** Wire the DriveManager so ambiguity-driven curiosity stimulation works. */
    setDriveManager(dm: {
        stimulate(driveId: string, amount: number): void;
    }): void;
    /** Phase E: attach source reputation (trust ceiling multiplier) post-construction. */
    setReputation(reputation: SourceReputation): void;
    constructor(config?: Partial<KernelPerceptionGateConfig>);
    /** One refusal for both judge faults and judge deadlines. */
    private judgeFault;
    /** Emit a shadow validation drop event to the gate's event log. */
    emitShadowValidationDrop(event: ShadowValidationDropEvent): void;
    admit(input: PerceptionGateInput): Promise<PerceptionGateOutput>;
    private decideAdmission;
    private admitViaJudge;
    private mapSource;
    /**
     * One parse, both answers. A string observation was parsed by `parseTask` up to
     * four times per admission — once to reach the term and again to reach the task
     * type, off the same text — so the text is read once here and each reader of the
     * result takes what it needs.
     */
    private parseObservation;
    admitTask(term: Term, taskType: TaskTypeName, truth?: TruthLike, source?: string, correlationId?: string): PerceptionGateOutput;
    private decideTaskAdmission;
    /**
     * The single admission path: budget derivation, `task.admitted` construction,
     * schema validation, and event push. Every gate entry point funnels here.
     */
    private emitAdmitted;
    admitFormalization(batch: FormalizationBatch, sourceQuality?: SourceQuality, source?: TaskAdmittedEvent['payload']['source']): {
        admitted: TaskAdmittedEvent['payload'][];
        rejected: {
            candidateId: string;
            reason: string;
        }[];
    };
}
//# sourceMappingURL=KernelPerceptionGate.d.ts.map