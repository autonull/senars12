import { tool } from 'ai';
import { z } from 'zod';
import type { CodemodResult } from '../codemod.js';
import { type SelfToolsContext, shadowChange } from './context.js';

export const applyFixTool = (ctx: SelfToolsContext) => {
  const { deps, shadowManager } = ctx;
  return tool({
    description:
      'Apply a semantic fix pattern to fix a test failure. Uses fix_pattern concepts mapped to codemod patterns. Executes in shadow worktree with test validation. Supports worktree reuse.',
    inputSchema: z.strictObject({
      fixPattern: z.string().describe('Fix pattern concept (e.g., "fix_pattern:null_check")'),
      targetFiles: z.array(z.string()).optional().describe('Specific files to apply fix to'),
      testName: z.string().optional().describe('Test that failed (for context)'),
      worktreeId: z.string().optional().describe('Existing worktree ID to reuse'),
    }),
    execute: async ({ fixPattern, targetFiles, testName, worktreeId: existingId }) => {
      const { nar } = deps;
      if (!nar) {
        return { success: false, error: 'NAR not available' };
      }

      const { getFixPatternMapping } = await import('../../impls/self-concept.js');
      const mapping = getFixPatternMapping(fixPattern);
      if (!mapping) {
        return { success: false, error: `Unknown fix pattern: ${fixPattern}` };
      }

      // A codemod rewrites whatever it matches, so the change is the codemod rather
      // than a file to write — but it is proved, approved and landed by the same
      // shadow boundary as the three tools that do name their file.
      const outcome = await shadowChange<CodemodResult>(ctx, 'fix', existingId, {
        validationError: 'Fix broke tests',
        approval: `Apply fix: ${fixPattern} for test ${testName ?? 'unknown'}`,
        merge: true,
        apply: async ({ path }) => {
          const codemodResult = await shadowManager.applyCodemodInWorktree(
            path,
            mapping.pattern,
            mapping.replacement,
            targetFiles ?? [],
            mapping.lang
          );
          return codemodResult.success && (codemodResult.matches ?? 0) > 0
            ? { ok: true, value: codemodResult }
            : { ok: false, error: 'No matches found for fix pattern' };
        },
      });

      if (!outcome.success) return outcome;

      nar.getExecution?.()?.stimulateDrives?.('test_passed');
      const { applied, testResult, diff, worktreeId } = outcome;
      return {
        success: true,
        fixPattern,
        diff,
        testResult,
        codemodResult: applied,
        message: 'Fix applied and validated',
        worktreeId,
      };
    },
  });
};
