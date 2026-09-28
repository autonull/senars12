import type { CognitiveController } from '../../../cognitive/controller.js';
import type { NAR } from '../../../nar.js';
import type { RLFPLearner } from '../../../rlfp/RLFPLearner.js';
import type { RuleProcessor } from '../../../rules/processor.js';
import type { ToolManager } from '../../tool-registry.js';
import type { ApprovalManager } from '../human-approval.js';
import type { ShadowWorktreeManager } from '../shadow-worktree.js';

export interface SelfToolsDeps {
  workspaceRoot?: string;
  nar?: NAR;
  rlfpLearner?: RLFPLearner;
  cognitiveController?: CognitiveController;
  toolManager?: ToolManager;
  ruleProcessor?: RuleProcessor;
  approvalManager?: ApprovalManager;
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
 * `{ ok: false, error: String(error) }` after `onError` rollback.
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
    return { ok: false, error: String(error) };
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
