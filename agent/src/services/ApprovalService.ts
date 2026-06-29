/**
 * Approval Service
 * Handles approval requests and management
 */

import type { Logger } from '../../../nar/src/logger';
import { createLogger } from '../../../nar/src/logger';
import { ApprovalManager } from '../../../nar/src/tools/adapters';
import type { PendingApproval } from '../types.js';

export interface ApprovalServiceConfig {
  approvalManager?: ApprovalManager;
  logger?: Logger;
}

export class ApprovalService {
  private readonly approvalManager: ApprovalManager;
  private readonly logger: Logger;

  constructor(config: ApprovalServiceConfig = {}) {
    this.approvalManager = config.approvalManager ?? new ApprovalManager();
    this.logger = config.logger ?? createLogger({ scope: 'agent:approval' });
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
