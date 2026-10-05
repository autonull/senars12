import { type CapabilityRisk, errMsg, makeId, withTimeout } from '@senars/util';
import { envBool } from '@senars/util/config';

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

export interface ApprovalResult {
  approved: boolean;
  reason?: string;
}

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
export class InMemoryApprovalManager implements ApprovalManager {
  private readonly pending = new Map<string, ApprovalRequest>();

  constructor(private readonly opts: ApprovalManagerOptions = {}) {}

  createRequest(request: string, metadata: Record<string, unknown> = {}): ApprovalRequest {
    const id = makeId();
    const { promise: result, resolve } = Promise.withResolvers<ApprovalResult>();
    const req: ApprovalRequest = {
      id,
      request,
      metadata,
      createdAt: Date.now(),
      result,
      resolve,
    };
    this.pending.set(id, req);
    this.opts.onRequest?.(req);
    return req;
  }

  resolveApproval(id: string, approved: boolean, reason?: string): boolean {
    const req = this.#take(id);
    if (!req) return false;
    req.resolve({ approved, reason });
    return true;
  }

  getPending(): ApprovalRequest[] {
    return [...this.pending.values()];
  }

  getPendingCount(): number {
    return this.pending.size;
  }

  #take(id: string): ApprovalRequest | undefined {
    const req = this.pending.get(id);
    this.pending.delete(id);
    return req;
  }
}

export class ApprovalService {
  private readonly approvalManager: ApprovalManager;

  constructor(config: ApprovalServiceConfig = {}) {
    this.approvalManager = config.approvalManager ?? new InMemoryApprovalManager();
  }

  async requestApproval(params: {
    action: string;
    payload: string;
    risk: CapabilityRisk;
    timeoutMs?: number;
  }): Promise<{ approved: boolean; feedback?: string }> {
    const request = `${params.action}\n\nPayload: ${params.payload}\nRisk: ${params.risk}`;
    const approvalRequest = this.approvalManager.createRequest(request, {
      action: params.action,
      risk: params.risk,
    });

    // Headless is not a rejection and not an error: the gate declines to ask, so
    // it answers its own question and resolves the promise. Anything else left it
    // rejected, on a path with no handler — an unhandled rejection, i.e. a crash.
    if (envBool('CI') || envBool('SENARS_HEADLESS')) {
      const feedback = 'Auto-rejected: headless mode';
      this.approvalManager.resolveApproval(approvalRequest.id, false, feedback);
      return { approved: false, feedback };
    }

    try {
      const result = await withTimeout(
        approvalRequest.result,
        params.timeoutMs ?? 60000,
        () => new Error('Approval timeout')
      );
      return { approved: result.approved, feedback: result.reason };
    } catch (err: unknown) {
      // The caller has stopped waiting, so the request is answered here rather
      // than left pending for a resolver who is not coming: `pending` grew by one
      // entry per timeout, which on a long-lived service is an unbounded map.
      const feedback = `Approval error: ${errMsg(err)}`;
      this.approvalManager.resolveApproval(approvalRequest.id, false, feedback);
      return { approved: false, feedback };
    }
  }
}
