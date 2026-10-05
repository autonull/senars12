import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ApprovalService } from '@senars/core';
import type { CapabilityRisk } from '@senars/util';
import { ensureParentDir, errMsg } from '@senars/util';
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
  approval?: ApprovalService;
}

export interface SelfToolsContext {
  deps: SelfToolsDeps;
  shadowManager: ShadowWorktreeManager;
  worktreeId: string;
}

export interface ShadowSession {
  /** Absolute path of the worktree the body may mutate. */
  readonly path: string;
  /** Worktree id to report back — the new id, or the reused one, never a
   *  reconstruction of the two. Every site used to answer `isNew ? id : existingId`,
   *  which is `id`. */
  readonly id: string;
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
  let path: string;

  if (existingId) {
    path = shadowManager.getWorktreePath(existingId) || '';
    if (!path) return { ok: false, error: `Worktree not found: ${existingId}` };
  } else {
    path = await shadowManager.createWorktree(id);
  }

  try {
    return { ok: true, value: await body({ path, id }) };
  } catch (error) {
    await onError?.(error);
    return { ok: false, error: errMsg(error) };
  } finally {
    if (!existingId) await shadowManager.cleanupWorktree(id);
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

/** Whether the change happened at all. A codemod that rewrote nothing is not a
 *  change that failed validation; it is a change that never happened, and it
 *  never reaches the test suite. */
export type ShadowApplied<T> = { ok: true; value: T } | { ok: false; error: string };

/** The risk a landing carries: self-written code reaching the working tree.
 *  `high` is the tier that "waits for a human" (\u00a7CapabilityRisk). */
const LANDING_RISK = 'high' satisfies CapabilityRisk;

/**
 * A change to prove in a shadow worktree, and the policy for landing it.
 *
 * `apply` reports what it produced, because what it produced is what the tool
 * reports: a codemod's match count is the evidence the change did anything.
 */
export interface ShadowChange<T = void> {
  readonly apply: (session: ShadowSession) => Promise<ShadowApplied<T>>;
  /** Reported when the worktree's own tests reject the change. */
  readonly validationError: string;
  /**
   * The action this landing is approved as, asked through core's `ApprovalService`
   * with the diff as its payload. Omitted to land unconditionally; declared with
   * no approval gate on the deps, it refuses — a gate that cannot be asked is not
   * a gate, and the tool description promises one.
   */
  readonly approval?: string;
  /**
   * Land the change once validated. Off by default, and off for the two tools
   * whose change is validated but deliberately *not* landed — a tool's code is
   * never compiled into the registry, and a rule is never compiled into the
   * processor. Their report says so; landing it anyway would contradict it.
   */
  readonly merge?: boolean;
}

export type ShadowChangeResult<T> =
  | { success: true; applied: T; diff: string; testResult: TestRunResult; worktreeId: string }
  | { success: false; error: string; reason?: string; testResult?: TestRunResult };

/**
 * Make a change in a shadow worktree, prove it with that worktree's tests, show
 * the diff, get it approved, land it.
 *
 * Every mutating self tool wrote this sequence out by hand and the copies had
 * already drifted: two asked for approval and two did not, every one of them
 * reported `worktreeId: isNew ? id : existingId` for a value the session already
 * carried, and two ignored `mergeWorktree`'s verdict and reported success for a
 * merge that never happened. The sequence *is* the shadow boundary, so it is one
 * function whose sites differ only in the change they make and the policy they
 * declare — and the approval it asks is core's `ApprovalService`, the gate the
 * capability sandbox already asks, so a landing cannot wait forever on a human
 * who is not there (and is refused outright when headless).
 */
export async function shadowChange<T>(
  ctx: SelfToolsContext,
  suffix: string,
  existingId: string | undefined,
  { apply, validationError, approval, merge = false }: ShadowChange<T>
): Promise<ShadowChangeResult<T>> {
  const { deps, shadowManager } = ctx;

  const gate = async (
    session: ShadowSession,
    applied: T,
    diff: string,
    testResult: TestRunResult
  ): Promise<ShadowChangeResult<T>> => {
    if (approval) {
      const refused = { success: false as const, error: 'Approval denied', testResult };
      if (!deps.approval) {
        return { ...refused, error: `${approval}: no approval gate configured` };
      }
      const { approved, feedback } = await deps.approval.requestApproval({
        action: approval,
        payload: diff,
        risk: LANDING_RISK,
      });
      if (!approved) return { ...refused, reason: feedback };
    }

    if (merge && !(await shadowManager.mergeWorktree(session.id))) {
      return { success: false, error: `Merge failed: ${session.id}`, testResult };
    }

    return { success: true, applied, diff, testResult, worktreeId: session.id };
  };

  const outcome = await withShadowWorktree<ShadowChangeResult<T>>(
    ctx,
    suffix,
    existingId,
    async (session) => {
      const applied = await apply(session);
      if (!applied.ok) return { success: false, error: applied.error };

      const testResult = await shadowManager.runTestsInWorktree(session.path);
      if (!testResult.success) return { success: false, error: validationError, testResult };

      const diff = await shadowManager.getDiff(session.path);
      return gate(session, applied.value, diff, testResult);
    }
  );

  return outcome.ok ? outcome.value : { success: false, error: outcome.error };
}

/** What {@link writeAndValidate} writes into a worktree — a change, by file. */
export interface ShadowWrite extends Omit<ShadowChange<void>, 'apply'> {
  /** Path relative to the worktree root. */
  readonly file: string;
  readonly contents: string;
}

export const writeAndValidate = (
  ctx: SelfToolsContext,
  suffix: string,
  existingId: string | undefined,
  { file, contents, ...policy }: ShadowWrite
): Promise<ShadowChangeResult<void>> =>
  shadowChange(ctx, suffix, existingId, {
    ...policy,
    apply: async ({ path }) => {
      const target = resolve(path, file);
      await ensureParentDir(target);
      await writeFile(target, contents, 'utf-8');
      return { ok: true, value: undefined };
    },
  });
