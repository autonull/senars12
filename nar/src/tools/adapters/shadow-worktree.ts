import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import type { CodemodResult } from './codemod.js';
import { runCodemod } from './codemod.js';

/** Shadow worktree manager for safe code modifications */
export class ShadowWorktreeManager {
  private workspaceRoot: string;
  private activeWorktrees: Map<string, string> = new Map(); // id -> path

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /** Create a new shadow worktree */
  async createWorktree(id: string): Promise<string> {
    const shadowDir = resolve(this.workspaceRoot, '.shadow', id);
    const { mkdir } = await import('node:fs/promises');
    await mkdir(dirname(shadowDir), { recursive: true });

    return new Promise((resolvePromise, reject) => {
      const child = spawn('git', ['worktree', 'add', shadowDir, 'HEAD'], {
        cwd: this.workspaceRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      child.on('close', (code) => {
        if (code === 0) {
          this.activeWorktrees.set(id, shadowDir);
          resolvePromise(shadowDir);
        } else {
          reject(new Error(`Failed to create worktree: ${code}`));
        }
      });

      child.on('error', (err) => reject(err));
    });
  }

  /** Get the path of an active worktree by id, or undefined if not found */
  getWorktreePath(id: string): string | undefined {
    return this.activeWorktrees.get(id);
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
  async runTestsInWorktree(worktreePath: string): Promise<{
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
  }> {
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
    let passed = 0,
      failed = 0,
      total = 0;
    try {
      const jsonStart = testResult.stdout.indexOf('{');
      if (jsonStart >= 0) {
        const data = JSON.parse(testResult.stdout.slice(jsonStart));
        passed = data.numPassedTests ?? 0;
        failed = data.numFailedTests ?? 0;
        total = data.numTotalTests ?? 0;
      }
    } catch {}

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
    return new Promise((resolve) => {
      const child = spawn('git', ['diff', 'HEAD'], {
        cwd: worktreePath,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
      child.on('close', () => resolve(stdout));
      child.on('error', () => resolve(''));
    });
  }

  /** Merge shadow worktree to main (requires approval) */
  async mergeWorktree(id: string): Promise<boolean> {
    const worktreePath = this.activeWorktrees.get(id);
    if (!worktreePath) return false;

    return new Promise((resolve) => {
      const child = spawn('git', ['commit', '-am', `Self-improvement: ${id}`], {
        cwd: worktreePath,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      child.on('close', (code) => {
        if (code === 0) {
          // Switch to main and merge
          const mergeChild = spawn('git', ['merge', id], {
            cwd: this.workspaceRoot,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          mergeChild.on('close', (mergeCode) => {
            if (mergeCode === 0) {
              this.cleanupWorktree(id);
              resolve(true);
            } else {
              resolve(false);
            }
          });
        } else {
          resolve(false);
        }
      });
    });
  }

  /** Clean up shadow worktree */
  async cleanupWorktree(id: string): Promise<void> {
    const worktreePath = this.activeWorktrees.get(id);
    if (!worktreePath) return;

    return new Promise((resolve) => {
      const child = spawn('git', ['worktree', 'remove', '--force', worktreePath], {
        cwd: this.workspaceRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      child.on('close', () => {
        this.activeWorktrees.delete(id);
        resolve();
      });
      child.on('error', () => {
        this.activeWorktrees.delete(id);
        resolve();
      });
    });
  }

  /** Run a command in the worktree and return result */
  private async runCommandInWorktree(
    worktreePath: string,
    command: string,
    args: string[]
  ): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        cwd: worktreePath,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ code: code ?? 1, stdout, stderr });
      });

      child.on('error', (err) => {
        resolve({ code: 1, stdout, stderr: err.message });
      });
    });
  }
}
