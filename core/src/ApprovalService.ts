import { createLogger, type LoggerInterface } from './Logger.js';

export interface PendingApproval {
  id: string;
  request: string;
  createdAt: number;
}

export interface ApprovalManager {
  resolveApproval(id: string, approved: boolean, reason?: string): boolean;
  getPending(): Array<{ id: string; request: string; createdAt: number }>;
}

export interface ApprovalServiceConfig {
  approvalManager?: ApprovalManager;
  logger?: LoggerInterface;
}

export class ApprovalService {
  private readonly approvalManager: ApprovalManager;
  private readonly logger: NonNullable<ApprovalServiceConfig['logger']>;

  constructor(config: ApprovalServiceConfig = {}) {
    this.approvalManager = config.approvalManager ?? {
      resolveApproval() {
        return false;
      },
      getPending() {
        return [];
      },
    };
    this.logger = config.logger ?? createLogger({ scope: 'approval' });
  }

  resolveApproval(id: string, approved: boolean, reason?: string): boolean {
    return this.approvalManager.resolveApproval(id, approved, reason);
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
