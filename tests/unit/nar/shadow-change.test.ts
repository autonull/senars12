import { ApprovalService, InMemoryApprovalManager } from '@senars/core';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type SelfToolsContext,
  shadowChange,
  writeAndValidate,
} from '../../../nar/src/tools/adapters/self/context.js';
import {
  ShadowWorktreeManager,
  type TestRunResult,
} from '../../../nar/src/tools/adapters/shadow-worktree.js';

const PASSING: TestRunResult = {
  success: true,
  testPassed: true,
  typecheckPassed: true,
  lintPassed: true,
  passed: 3,
  failed: 0,
  total: 3,
};

const FAILING: TestRunResult = { ...PASSING, success: false, testPassed: false, failed: 1 };

/**
 * The shadow boundary, proved on its own terms.
 *
 * Every mutating self tool used to write `apply → test → diff → approve → merge`
 * by hand, and the copies had already drifted in ways no test could have caught,
 * because there was no test: two of them merged without asking, two reported a
 * merge that had failed, and all of them rebuilt the worktree id from two
 * variables when the session carried it. This drives the sequence over a manager
 * whose only real behaviour — `git worktree`, `pnpm vitest` — is replaced by the
 * observation it would have made, so what is asserted is the order and the gates,
 * which is the part that was hand-written five times. The worktree *is* a real
 * directory under a temp root, so the half that writes is exercised rather than
 * replaced.
 */
class ObservedShadowManager extends ShadowWorktreeManager {
  readonly observed: string[] = [];
  readonly worktrees = new Map<string, string>();
  verdict: TestRunResult = PASSING;
  mergeSucceeds = true;

  constructor(root: string) {
    super(root);
  }

  override async createWorktree(id: string): Promise<string> {
    const path = join(this.workspaceRoot, '.shadow', id);
    await mkdir(path, { recursive: true });
    this.observed.push(`create:${id}`);
    this.worktrees.set(id, path);
    return path;
  }

  override getWorktreePath(id: string): string | undefined {
    return this.worktrees.get(id);
  }

  override async cleanupWorktree(id: string): Promise<void> {
    this.observed.push(`cleanup:${id}`);
    this.worktrees.delete(id);
  }

  override async runTestsInWorktree(path: string): Promise<TestRunResult> {
    this.observed.push(`test:${path}`);
    return this.verdict;
  }

  override async getDiff(path: string): Promise<string> {
    this.observed.push(`diff:${path}`);
    return `- ${path}/change.ts`;
  }

  override async mergeWorktree(id: string): Promise<boolean> {
    this.observed.push(`merge:${id}`);
    return this.mergeSucceeds;
  }
}

/** The gate as production gets it: core's service over an in-memory registry whose
 *  only resolver is the one this test installs. */
const gate = (answer: (id: string) => boolean | undefined, asked?: string[]): ApprovalService => {
  const manager = new InMemoryApprovalManager({
    onRequest: (request) => {
      asked?.push(request.request);
      const verdict = answer(request.id);
      if (verdict !== undefined) manager.resolveApproval(request.id, verdict, 'not this time');
    },
  });
  return new ApprovalService({ approvalManager: manager });
};

const roots: string[] = [];

async function harness(approval?: ApprovalService) {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'senars-shadow-'));
  roots.push(workspaceRoot);
  const shadowManager = new ObservedShadowManager(workspaceRoot);
  const ctx = { deps: { approval }, shadowManager, worktreeId: 'wt' } as SelfToolsContext;
  return { shadowManager, ctx, pathOf: (id: string) => join(workspaceRoot, '.shadow', id) };
}

const write = (policy: { merge?: boolean } = {}) => ({
  apply: async () => ({ ok: true as const, value: undefined }),
  validationError: 'Write failed validation',
  ...policy,
});

afterEach(async () => {
  delete process.env.SENARS_HEADLESS;
  delete process.env.CI;
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('the shadow change pipeline', () => {
  it('applies, proves, diffs and cleans up in that order, reporting the session id', async () => {
    const { ctx, shadowManager, pathOf } = await harness();

    const outcome = await writeAndValidate(ctx, 'rule', undefined, {
      ...write(),
      file: 'rules/promoted.ts',
      contents: 'export const rule = 1;',
    });

    expect(outcome.success).toBe(true);
    expect(shadowManager.observed).toEqual([
      'create:wt-rule',
      `test:${pathOf('wt-rule')}`,
      `diff:${pathOf('wt-rule')}`,
      'cleanup:wt-rule',
    ]);
    if (outcome.success) expect(outcome.worktreeId).toBe('wt-rule');
    await expect(readFile(join(pathOf('wt-rule'), 'rules/promoted.ts'), 'utf-8')).resolves.toBe(
      'export const rule = 1;'
    );
  });

  it('reuses a named worktree without creating or cleaning up another', async () => {
    const { ctx, shadowManager, pathOf } = await harness();
    shadowManager.worktrees.set('given', pathOf('given'));

    const outcome = await writeAndValidate(ctx, 'rule', 'given', {
      ...write(),
      file: 'rules/promoted.ts',
      contents: 'export const rule = 1;',
    });

    expect(outcome.success).toBe(true);
    expect(shadowManager.observed).toEqual([`test:${pathOf('given')}`, `diff:${pathOf('given')}`]);
    if (outcome.success) expect(outcome.worktreeId).toBe('given');
  });

  it('reports a missing named worktree without applying anything', async () => {
    const { ctx, shadowManager } = await harness();

    const outcome = await writeAndValidate(ctx, 'rule', 'nowhere', {
      ...write(),
      file: 'rules/promoted.ts',
      contents: 'export const rule = 1;',
    });

    expect(outcome).toEqual({ success: false, error: 'Worktree not found: nowhere' });
    expect(shadowManager.observed).toEqual([]);
  });

  it('stops at validation: no diff, no approval, no landing', async () => {
    const asked: string[] = [];
    const { ctx, shadowManager, pathOf } = await harness(gate(() => true, asked));
    shadowManager.verdict = FAILING;

    const outcome = await shadowChange(ctx, 'scaffold', undefined, {
      apply: async () => ({ ok: true, value: 7 }),
      validationError: 'Capability validation failed',
      approval: 'Add capability: web_search',
      merge: true,
    });

    expect(outcome).toMatchObject({ success: false, error: 'Capability validation failed' });
    expect(asked).toEqual([]);
    expect(shadowManager.observed).toEqual([
      'create:wt-scaffold',
      `test:${pathOf('wt-scaffold')}`,
      'cleanup:wt-scaffold',
    ]);
  });

  it('a change that did not happen is never tested', async () => {
    const { ctx, shadowManager } = await harness();

    const outcome = await shadowChange(ctx, 'fix', undefined, {
      apply: async () => ({ ok: false, error: 'No matches found for fix pattern' }),
      validationError: 'Fix broke tests',
      merge: true,
    });

    expect(outcome).toEqual({ success: false, error: 'No matches found for fix pattern' });
    expect(shadowManager.observed).toEqual(['create:wt-fix', 'cleanup:wt-fix']);
  });

  it('lands after an approval that read the action and the diff, carrying the applied result', async () => {
    const asked: string[] = [];
    const { ctx, shadowManager, pathOf } = await harness(gate(() => true, asked));

    const outcome = await shadowChange(ctx, 'fix', undefined, {
      apply: async () => ({ ok: true, value: { matches: 4 } }),
      validationError: 'Fix broke tests',
      approval: 'Apply fix: fix_pattern:null_check',
      merge: true,
    });

    expect(outcome).toMatchObject({ success: true, applied: { matches: 4 }, worktreeId: 'wt-fix' });
    expect(shadowManager.observed).toEqual([
      'create:wt-fix',
      `test:${pathOf('wt-fix')}`,
      `diff:${pathOf('wt-fix')}`,
      'merge:wt-fix',
      'cleanup:wt-fix',
    ]);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain('Apply fix: fix_pattern:null_check');
    expect(asked[0]).toContain(`- ${pathOf('wt-fix')}/change.ts`);
  });

  it('a denied approval is a refusal, and nothing lands', async () => {
    const { ctx, shadowManager } = await harness(gate(() => false));

    const outcome = await shadowChange(ctx, 'scaffold', undefined, {
      apply: async () => ({ ok: true, value: undefined }),
      validationError: 'Capability validation failed',
      approval: 'Add capability: web_search',
      merge: true,
    });

    expect(outcome).toMatchObject({ success: false, error: 'Approval denied' });
    expect(shadowManager.observed.some((call) => call.startsWith('merge'))).toBe(false);
  });

  it('refuses a change that declares an approval when no gate can answer', async () => {
    const { ctx, shadowManager } = await harness();

    const outcome = await shadowChange(ctx, 'scaffold', undefined, {
      apply: async () => ({ ok: true, value: undefined }),
      validationError: 'Capability validation failed',
      approval: 'Add capability: web_search',
      merge: true,
    });

    expect(outcome).toMatchObject({
      success: false,
      error: 'Add capability: web_search: no approval gate configured',
    });
    expect(shadowManager.observed.some((call) => call.startsWith('merge'))).toBe(false);
  });

  it('headless refuses rather than waiting for a human who is not there', async () => {
    process.env.SENARS_HEADLESS = 'true';
    const { ctx, shadowManager } = await harness(gate(() => undefined));

    const outcome = await shadowChange(ctx, 'scaffold', undefined, {
      apply: async () => ({ ok: true, value: undefined }),
      validationError: 'Capability validation failed',
      approval: 'Add capability: web_search',
      merge: true,
    });

    expect(outcome).toMatchObject({ success: false, error: 'Approval denied' });
    expect(shadowManager.observed.some((call) => call.startsWith('merge'))).toBe(false);
  });

  it('reports a landing that failed instead of a change that landed', async () => {
    const { ctx, shadowManager } = await harness();
    shadowManager.mergeSucceeds = false;

    const outcome = await writeAndValidate(ctx, 'rule', undefined, {
      ...write({ merge: true }),
      file: 'rules/promoted.ts',
      contents: 'export const rule = 1;',
    });

    expect(outcome).toMatchObject({ success: false, error: 'Merge failed: wt-rule' });
  });

  it('lands without asking when no approval is declared', async () => {
    const asked: string[] = [];
    const { ctx, shadowManager } = await harness(gate(() => true, asked));

    const outcome = await writeAndValidate(ctx, 'rule', undefined, {
      ...write({ merge: true }),
      file: 'rules/promoted.ts',
      contents: 'export const rule = 1;',
    });

    expect(outcome.success).toBe(true);
    expect(asked).toEqual([]);
    expect(shadowManager.observed).toContain('merge:wt-rule');
  });
});
