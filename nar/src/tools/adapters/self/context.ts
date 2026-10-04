import type { InMemoryApprovalManager } from '@senars/core';
import { errMsg } from '@senars/util';
import type { CognitiveController } from '../../../cognitive/impls/CognitiveController.js';
import type { NAR } from '../../../nar.js';
import type { RLFPLearner } from '../../../rlfp/RLFPLearner.js';
import type { RuleProcessor } from '../../../rules/impls/processor.js';
import type { ToolManager } from '../../impls/tool-registry.js';
import type { ShadowWorktreeManager, TestRunResult } from '../shadow-worktree.js';

export interface SelfToolsDeps {
  workspaceRoot?: string;
  nar?: NAR;
  rlfpLearner?: RLFPLearner;
  cognitiveController?: CognitiveController;
  toolManager?: ToolManager;
  ruleProcessor?: RuleProcessor;
  approvalManager?: InMemoryApprovalManager;
}

export interface SelfToolsContext {
  deps: SelfToolsDeps;
  shadowManager: ShadowWorktreeManager;
  worktreeId: string;
}

export interface ShadowSession {
  /** Absolute path of the worktree the body may mutate. */
  path: string;
  /** Worktree id to report back (the new id, or the reused one). */
  id: string;
  /** True when this call created the worktree (it will be cleaned up). */
  isNew: boolean;
}

export type ShadowOutcome<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Acquire a shadow worktree, run `body` against it, and always clean up a
 * freshly created one. Reuses `existingId` when given; a missing worktree is
 * reported as `{ ok: false }` without running the body. Thrown errors become
 * `{ ok: false, error: errMsg(error) }` after `onError` rollback.
 */
export async function withShadowWorktree<T>(
  { shadowManager, worktreeId }: Pick<SelfToolsContext, 'shadowManager' | 'worktreeId'>,
  suffix: string,
  existingId: string | undefined,
  body: (session: ShadowSession) => Promise<T>,
  onError?: (error: unknown) => Promise<void> | void
): Promise<ShadowOutcome<T>> {
  const id = existingId || `${worktreeId}-${suffix}`;
  const isNew = !existingId;
  let path: string;

  if (existingId) {
    path = shadowManager.getWorktreePath(existingId) || '';
    if (!path) return { ok: false, error: `Worktree not found: ${existingId}` };
  } else {
    path = await shadowManager.createWorktree(id);
  }

  try {
    return { ok: true, value: await body({ path, id, isNew }) };
  } catch (error) {
    await onError?.(error);
    return { ok: false, error: errMsg(error) };
  } finally {
    if (isNew) await shadowManager.cleanupWorktree(id);
  }
}

/** Flatten a shadow outcome into the tool-result shape every self tool returns. */
export function toToolResult<T extends { success: boolean }>(
  outcome: ShadowOutcome<T>
): T | { success: false; error: string } {
  return outcome.ok ? outcome.value : { success: false, error: outcome.error };
}

/**
 * The apply-then-validate flow shared by every mutating self tool: apply the
 * change, run the worktree's tests inside a shadow worktree, and roll back when
 * validation fails or the body throws.
 */
export async function applyAndValidate<T extends { success: boolean }>(
  ctx: SelfToolsContext,
  suffix: string,
  existingId: string | undefined,
  failureMessage: string,
  apply: () => void,
  revert: () => void,
  commit: (session: ShadowSession, testResult: TestRunResult) => Promise<T>
): Promise<T | { success: false; error: string }> {
  const { shadowManager } = ctx;
  apply();
  return toToolResult(
    await withShadowWorktree(
      ctx,
      suffix,
      existingId,
      async (session) => {
        const testResult = await shadowManager.runTestsInWorktree(session.path);
        if (!testResult.success) {
          revert();
          return { success: false, error: failureMessage, testResult };
        }
        return commit(session, testResult);
      },
      revert
    )
  );
}
