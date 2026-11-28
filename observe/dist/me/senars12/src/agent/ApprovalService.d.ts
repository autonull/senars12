import type { Verdict } from '../schemas/gate-io';
import type { CapabilityRisk } from '@senars/util/capability-risk';
/** A question put to whoever holds the gate, and the one way it is answered.
 *  There is no rejection channel: a request nobody answered and a request that was
 *  answered `false` are the same event to the caller, and both *resolve* — a
 *  rejected `result` had no handler on the headless path, which under Node's
 *  default is an unhandled rejection, i.e. a process exit from inside a gate that
 *  was only trying to decline. */
export interface ApprovalRequest {
    id: string;
    request: string;
    metadata: Record<string, unknown>;
    createdAt: number;
    result: Promise<ApprovalResult>;
    resolve: (result: ApprovalResult) => void;
}
/** An answer as the registry records it: the grant, and why not when refused. The
 *  gate reads the same verdict in its own vocabulary, `Verdict<'approved', 'feedback'>`. */
export type ApprovalResult = Verdict<'approved'>;
export interface ApprovalManager {
    createRequest(request: string, metadata?: Record<string, unknown>): ApprovalRequest;
    /** Answer a pending request. `approved: false` is a refusal, and it resolves the
     *  request's promise — the answer carries *why* in `reason`. The only channel:
     *  whoever stops waiting answers too (see {@link ApprovalService}), so a request
     *  cannot be left pending with nobody left to answer it. */
    resolveApproval(id: string, approved: boolean, reason?: string): boolean;
    getPending(): ApprovalRequest[];
    getPendingCount(): number;
}
export interface ApprovalServiceConfig {
    approvalManager?: ApprovalManager;
}
export interface ApprovalManagerOptions {
    /** Observer invoked on every newly created request (pending-approval surfaces). */
    onRequest?: (request: ApprovalRequest) => void;
}
/** In-memory pending-approval registry: the default `ApprovalManager` implementation. */
export declare class InMemoryApprovalManager implements ApprovalManager {
    #private;
    private readonly opts;
    private readonly pending;
    constructor(opts?: ApprovalManagerOptions);
    createRequest(request: string, metadata?: Record<string, unknown>): ApprovalRequest;
    resolveApproval(id: string, approved: boolean, reason?: string): boolean;
    getPending(): ApprovalRequest[];
    getPendingCount(): number;
}
export declare class ApprovalService {
    private readonly approvalManager;
    constructor(config?: ApprovalServiceConfig);
    requestApproval(params: {
        action: string;
        payload: string;
        risk: CapabilityRisk;
        timeoutMs?: number;
    }): Promise<Verdict<'approved', 'feedback'>>;
}
//# sourceMappingURL=ApprovalService.d.ts.map