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
  logger?: {
    debug: (msg: string, ctx?: unknown) => void;
    info: (msg: string, ctx?: unknown) => void;
    warn: (msg: string, ctx?: unknown) => void;
    error: (msg: string, err?: unknown, ctx?: unknown) => void;
  };
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
    this.logger = config.logger ?? consoleLogger;
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

const consoleLogger = {
  debug: (msg: string, ctx?: unknown) => console.debug(`[approval] ${msg}`, ctx),
  info: (msg: string, ctx?: unknown) => console.info(`[approval] ${msg}`, ctx),
  warn: (msg: string, ctx?: unknown) => console.warn(`[approval] ${msg}`, ctx),
  error: (msg: string, err?: unknown, ctx?: unknown) =>
    console.error(`[approval] ${msg}`, err, ctx),
};
