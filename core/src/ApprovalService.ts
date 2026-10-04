import { type CapabilityRisk, errMsg, makeId, withTimeout } from '@senars/util';
import { envBool } from '@senars/util/config';

export interface ApprovalRequest {
  id: string;
  request: string;
  metadata: Record<string, unknown>;
  createdAt: number;
  result: Promise<ApprovalResult>;
  resolve: (result: ApprovalResult) => void;
  reject: (error: Error) => void;
}

export interface ApprovalResult {
  approved: boolean;
  reason?: string;
}

export interface ApprovalManager {
  createRequest(request: string, metadata?: Record<string, unknown>): ApprovalRequest;

  resolveApproval(id: string, approved: boolean, reason?: string): boolean;

  rejectApproval(id: string, error: string): boolean;

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
    const { promise: result, resolve, reject } = Promise.withResolvers<ApprovalResult>();
    const req: ApprovalRequest = {
      id,
      request,
      metadata,
      createdAt: Date.now(),
      result,
      resolve,
      reject,
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

  rejectApproval(id: string, error: string): boolean {
    const req = this.#take(id);
    if (!req) return false;
    req.reject(new Error(error));
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

    if (envBool('CI') || envBool('SENARS_HEADLESS')) {
      this.approvalManager.rejectApproval(approvalRequest.id, 'Auto-rejected: headless mode');
      return { approved: false, feedback: 'Auto-rejected in headless mode' };
    }

    try {
      const result = await withTimeout(
        approvalRequest.result,
        params.timeoutMs ?? 60000,
        () => new Error('Approval timeout')
      );
      return { approved: result.approved, feedback: result.reason };
    } catch (err: unknown) {
      return {
        approved: false,
        feedback: `Approval error: ${errMsg(err)}`,
      };
    }
  }
}
