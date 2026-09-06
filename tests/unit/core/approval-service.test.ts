import { describe, expect, it } from 'vitest';
import { ApprovalService, type ApprovalManager } from '../../../core/src/ApprovalService';

const createManager = (): ApprovalManager & { pending: ReturnType<ApprovalManager['getPending']> } => {
  const pending = new Map<string, { id: string; resolve: (r: unknown) => void }>();
  const manager: ApprovalManager = {
    createRequest(request, metadata = {}) {
      const id = `req-${pending.size + 1}`;
      let resolveFn!: (r: unknown) => void;
      const result = new Promise((resolve) => (resolveFn = resolve));
      pending.set(id, { id, resolve: resolveFn });
      return { id, request, metadata, createdAt: Date.now(), result: result as Promise<never>, resolve: resolveFn as never, reject: (() => {}) as never };
    },
    resolveApproval(id, approved, reason) {
      const req = pending.get(id);
      if (!req) return false;
      req.resolve({ approved, reason });
      pending.delete(id);
      return true;
    },
    rejectApproval(id) {
      const req = pending.get(id);
      if (!req) return false;
      req.resolve({ approved: false, reason: 'rejected' });
      pending.delete(id);
      return true;
    },
    getPending() {
      return [...pending.values()].map((p) => ({
        id: p.id,
        request: '',
        metadata: {},
        createdAt: 0,
        result: Promise.resolve({ approved: false }) as never,
        resolve: p.resolve as never,
        reject: (() => {}) as never,
      }));
    },
    getPendingCount() {
      return pending.size;
    },
  };
  return { ...manager, pending };
};

describe('ApprovalService', () => {
  it('blocks changes when approval is denied', async () => {
    const manager = createManager();
    const service = new ApprovalService({ approvalManager: manager });

    const promise = service.requestApproval({ action: 'apply_fix', payload: 'diff', risk: 'high' });

    // Simulate human denying via the manager's pending request
    const pending = manager.getPending();
    expect(pending).toHaveLength(1);
    manager.resolveApproval(pending[0]!.id, false, 'not now');

    const result = await promise;
    expect(result.approved).toBe(false);
    expect(result.feedback).toBe('not now');
  });

  it('allows changes when approval is granted', async () => {
    const manager = createManager();
    const service = new ApprovalService({ approvalManager: manager });

    const promise = service.requestApproval({ action: 'scaffold_capability', payload: 'template', risk: 'medium' });

    const pending = manager.getPending();
    manager.resolveApproval(pending[0]!.id, true);

    const result = await promise;
    expect(result.approved).toBe(true);
  });

  it('auto-rejects in headless mode', async () => {
    const prev = process.env.SENARS_HEADLESS;
    process.env.SENARS_HEADLESS = '1';
    try {
      const manager = createManager();
      const service = new ApprovalService({ approvalManager: manager });

      const result = await service.requestApproval({ action: 'apply_fix', payload: 'diff', risk: 'high' });
      expect(result.approved).toBe(false);
      expect(result.feedback).toContain('headless');
    } finally {
      if (prev === undefined) delete process.env.SENARS_HEADLESS;
      else process.env.SENARS_HEADLESS = prev;
    }
  });
});