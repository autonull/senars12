import { randomUUID } from 'node:crypto';
import { tool } from 'ai';
import { z } from 'zod';

// --- human_approval ---

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

export interface ApprovalManagerOptions {
  onRequest?: (request: ApprovalRequest) => void;
}

export class ApprovalManager {
  private readonly pending = new Map<string, ApprovalRequest>();
  private readonly onRequest?: (request: ApprovalRequest) => void;

  constructor(opts: ApprovalManagerOptions = {}) {
    this.onRequest = opts.onRequest;
  }

  createRequest(request: string, metadata: Record<string, unknown> = {}): ApprovalRequest {
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
    this.pending.set(id, req);
    this.onRequest?.(req);
    return req;
  }

  resolveApproval(id: string, approved: boolean, reason?: string): boolean {
    const req = this.pending.get(id);
    if (!req) return false;
    this.pending.delete(id);
    req.resolve({ approved, reason });
    return true;
  }

  rejectApproval(id: string, error: string): boolean {
    const req = this.pending.get(id);
    if (!req) return false;
    this.pending.delete(id);
    req.reject(new Error(error));
    return true;
  }

  getPending(): ApprovalRequest[] {
    return Array.from(this.pending.values());
  }

  getPendingCount(): number {
    return this.pending.size;
  }
}

export function createHumanApprovalTool(manager: ApprovalManager) {
  return {
    human_approval: tool({
      description:
        'Request human approval before proceeding with an action. Pauses until a human approves or rejects.',
      inputSchema: z.object({
        request: z.string().describe('Clear description of what you want approval for'),
        context: z.string().optional().describe('Additional context to help the human decide'),
      }),
      execute: async ({ request, context }) => {
        const fullRequest = context ? `${request}\n\nContext: ${context}` : request;
        const req = manager.createRequest(fullRequest, { timestamp: Date.now() });
        const result = await req.result;
        return {
          id: req.id,
          request: fullRequest,
          approved: result.approved,
          reason: result.reason,
        };
      },
    }),
  };
}
