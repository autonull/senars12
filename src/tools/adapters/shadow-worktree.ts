import { resolve } from 'node:path';
import { ensureParentDir, parseJsonObject } from '@senars/util';
import type { CodemodResult } from './codemod.js';
import { runCodemod } from './codemod.js';
import { runProcess } from './proc.js';

/** Aggregate vitest + typecheck + lint verdict for one worktree run. */
export interface TestRunResult {
  success: boolean;
  testPassed: boolean;
  typecheckPassed: boolean;
  lintPassed: boolean;
  passed: number;
  failed: number;
  total: number;
  testOutput?: string;
  typecheckOutput?: string;
  lintOutput?: string;
}

/** Shadow worktree manager for safe code modifications */
export class ShadowWorktreeManager {
  protected readonly workspaceRoot: string;
  /** id -> path. The worktrees this manager owns and is allowed to land. */
  readonly #activeWorktrees = new Map<string, string>();

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /** Create a new shadow worktree */
  async createWorktree(id: string): Promise<string> {
    const shadowDir = resolve(this.workspaceRoot, '.shadow', id);
    const { mkdir } = await import('node:fs/promises');
    await ensureParentDir(shadowDir);

    const { code, stderr } = await runProcess('git', ['worktree', 'add', shadowDir, 'HEAD'], {
      cwd: this.workspaceRoot,
    });
    if (code !== 0) throw new Error(`Failed to create worktree: ${code} ${stderr}`);
    this.#activeWorktrees.set(id, shadowDir);
    return shadowDir;
  }

  /** Get the path of an active worktree by id, or undefined if not found */
  getWorktreePath(id: string): string | undefined {
    return this.#activeWorktrees.get(id);
  }

  /** Apply codemod in shadow worktree */
  async applyCodemodInWorktree(
    worktreePath: string,
    pattern: string,
    replacement: string,
    scope: string[] = [],
    lang = 'typescript'
  ): Promise<CodemodResult> {
    return runCodemod(worktreePath, { pattern, replacement, scope, lang }, false);
  }

  /** Run full CI suite in shadow worktree */
  async runTestsInWorktree(worktreePath: string): Promise<TestRunResult> {
    // Run vitest
    const testResult = await this.runCommandInWorktree(worktreePath, 'pnpm', [
      'vitest',
      'run',
      '--reporter=json',
    ]);
    // Run typecheck
    const typecheckResult = await this.runCommandInWorktree(worktreePath, 'pnpm', ['typecheck']);
    // Run lint
    const lintResult = await this.runCommandInWorktree(worktreePath, 'pnpm', ['lint']);

    const testSuccess = testResult.code === 0;
    const typecheckSuccess = typecheckResult.code === 0;
    const lintSuccess = lintResult.code === 0;

    // Parse vitest JSON output for test counts
    const counts = parseJsonObject<Record<string, number>>(testResult.stdout);
    const passed = counts?.numPassedTests ?? 0;
    const failed = counts?.numFailedTests ?? 0;
    const total = counts?.numTotalTests ?? 0;

    return {
      success: testSuccess && typecheckSuccess && lintSuccess,
      testPassed: testSuccess,
      typecheckPassed: typecheckSuccess,
      lintPassed: lintSuccess,
      passed,
      failed,
      total,
      testOutput: testResult.stdout,
      typecheckOutput: typecheckResult.stdout,
      lintOutput: lintResult.stdout,
    };
  }

  /** Get diff between shadow worktree and main */
  async getDiff(worktreePath: string): Promise<string> {
    return (await runProcess('git', ['diff', 'HEAD'], { cwd: worktreePath })).stdout;
  }

  /** Merge shadow worktree to main (requires approval) */
  async mergeWorktree(id: string): Promise<boolean> {
    const worktreePath = this.#activeWorktrees.get(id);
    if (!worktreePath) return false;

    const commit = await runProcess('git', ['commit', '-am', `Self-improvement: ${id}`], {
      cwd: worktreePath,
    });
    if (commit.code !== 0) return false;
    const merge = await runProcess('git', ['merge', id], { cwd: this.workspaceRoot });
    if (merge.code !== 0) return false;
    await this.cleanupWorktree(id);
    return true;
  }

  /** Clean up shadow worktree */
  async cleanupWorktree(id: string): Promise<void> {
    const worktreePath = this.#activeWorktrees.get(id);
    if (!worktreePath) return;

    await runProcess('git', ['worktree', 'remove', '--force', worktreePath], {
      cwd: this.workspaceRoot,
    });
    this.#activeWorktrees.delete(id);
  }

  /** Run a command in the worktree and return result */
  private async runCommandInWorktree(
    worktreePath: string,
    command: string,
    args: string[]
  ): Promise<{ code: number; stdout: string; stderr: string }> {
    return runProcess(command, args, { cwd: worktreePath });
  }
}
