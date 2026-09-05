import { createLogger, type LoggerInterface } from './Logger.js';
import { randomUUID } from 'node:crypto';

export interface PendingApproval {
  id: string;
  request: string;
  createdAt: number;
}

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
  logger?: LoggerInterface;
}

export class ApprovalService {
  private readonly approvalManager: ApprovalManager;
  private readonly logger: NonNullable<ApprovalServiceConfig['logger']>;

  constructor(config: ApprovalServiceConfig = {}) {
    this.approvalManager = config.approvalManager ?? this.createDefaultManager();
    this.logger = config.logger ?? createLogger({ scope: 'approval' });
  }

  private createDefaultManager(): ApprovalManager {
    const pending = new Map<string, ApprovalRequest>();

    return {
      createRequest(request: string, metadata: Record<string, unknown> = {}) {
        const id = randomUUID();
        let resolveFn!: (result: ApprovalResult) => void;
        let rejectFn!: (error: Error) => void;
        const result = new Promise<ApprovalResult>((resolve, reject) => {
          resolveFn = resolve;
          rejectFn = reject;
        });
        const req: ApprovalRequest = {
          id,
          request,
          metadata,
          createdAt: Date.now(),
          result,
          resolve: resolveFn,
          reject: rejectFn,
        };
        pending.set(id, req);
        return req;
      },
      resolveApproval(id: string, approved: boolean, reason?: string): boolean {
        const req = pending.get(id);
        if (!req) return false;
        pending.delete(id);
        req.resolve({ approved, reason });
        return true;
      },
      rejectApproval(id: string, error: string): boolean {
        const req = pending.get(id);
        if (!req) return false;
        pending.delete(id);
        req.reject(new Error(error));
        return true;
      },
      getPending(): ApprovalRequest[] {
        return Array.from(pending.values());
      },
      getPendingCount(): number {
        return pending.size;
      },
    };
  }

  async requestApproval(params: {
    action: string;
    payload: string;
    risk: 'low' | 'medium' | 'high';
    timeoutMs?: number;
  }): Promise<{ approved: boolean; feedback?: string }> {
    const request = `${params.action}\n\nPayload: ${params.payload}\nRisk: ${params.risk}`;
    const approvalRequest = this.approvalManager.createRequest(request, {
      action: params.action,
      risk: params.risk,
    });

    if (process.env.CI === 'true' || process.env.SENARS_HEADLESS === '1') {
      this.approvalManager.rejectApproval(approvalRequest.id, 'Auto-rejected: headless mode');
      return { approved: false, feedback: 'Auto-rejected in headless mode' };
    }

    try {
      const result = await Promise.race([
        approvalRequest.result,
        new Promise<ApprovalResult>((_, reject) =>
          setTimeout(() => reject(new Error('Approval timeout')), params.timeoutMs ?? 60000)
        ),
      ]);
      return { approved: result.approved, feedback: result.reason };
    } catch (err: any) {
      return { approved: false, feedback: `Approval error: ${err.message}` };
    }
  }

  resolveApproval(id: string, approved: boolean, reason?: string): boolean {
    return this.approvalManager.resolveApproval(id, approved, reason);
  }

  rejectApproval(id: string, error: string): boolean {
    return this.approvalManager.rejectApproval(id, error);
  }

  getPendingApprovals(): PendingApproval[] {
    return this.approvalManager.getPending().map((r) => ({
      id: r.id,
      request: r.request,
      createdAt: r.createdAt,
    }));
  }

  getApprovalManager(): ApprovalManager {
    return this.approvalManager;
  }
}
