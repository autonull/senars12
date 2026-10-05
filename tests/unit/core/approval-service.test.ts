import { describe, expect, it } from 'vitest';
import { type ApprovalManager, ApprovalService } from '../../../core/src/ApprovalService';

const createManager = (): ApprovalManager & {
  pending: Map<string, { id: string; resolve: (r: unknown) => void }>;
} => {
  const pending = new Map<string, { id: string; resolve: (r: unknown) => void }>();
  const manager: ApprovalManager = {
    createRequest(request, metadata = {}) {
      const id = `req-${pending.size + 1}`;
      let resolveFn!: (r: unknown) => void;
      const result = new Promise((resolve) => (resolveFn = resolve));
      pending.set(id, { id, resolve: resolveFn });
      return {
        id,
        request,
        metadata,
        createdAt: Date.now(),
        result: result as Promise<never>,
        resolve: resolveFn as never,
      };
    },
    resolveApproval(id, approved, reason) {
      const req = pending.get(id);
      if (!req) return false;
      req.resolve({ approved, reason });
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

    const promise = service.requestApproval({
      action: 'scaffold_capability',
      payload: 'template',
      risk: 'medium',
    });

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

      const result = await service.requestApproval({
        action: 'apply_fix',
        payload: 'diff',
        risk: 'high',
      });
      expect(result.approved).toBe(false);
      expect(result.feedback).toContain('headless');
    } finally {
      if (prev === undefined) delete process.env.SENARS_HEADLESS;
      else process.env.SENARS_HEADLESS = prev;
    }
  });

  it('answers its own question when headless, so the request settles', async () => {
    // The gate's answer is the only thing the request's promise can settle with,
    // and a refusal is a resolution rather than a rejection: a rejection here had
    // no handler, which is a process exit rather than a declined landing.
    process.env.SENARS_HEADLESS = '1';
    try {
      const manager = createManager();
      const service = new ApprovalService({ approvalManager: manager });
      await service.requestApproval({ action: 'apply_fix', payload: 'diff', risk: 'high' });

      const [settled] = manager.getPending();
      expect(settled).toBeUndefined();
      expect(manager.getPendingCount()).toBe(0);
    } finally {
      delete process.env.SENARS_HEADLESS;
    }
  });

  it('does not keep a request pending for a resolver who timed out', async () => {
    const manager = createManager();
    const service = new ApprovalService({ approvalManager: manager });

    const result = await service.requestApproval({
      action: 'apply_fix',
      payload: 'diff',
      risk: 'high',
      timeoutMs: 1,
    });

    expect(result.approved).toBe(false);
    expect(manager.getPendingCount()).toBe(0);
  });
});
