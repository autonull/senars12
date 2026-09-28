import { tool } from 'ai';
import { z } from 'zod';
import { type SelfToolsContext, toToolResult, withShadowWorktree } from './context.js';

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

      const { getFixPatternMapping } = await import('../../self-concept.js');
      const mapping = getFixPatternMapping(fixPattern);
      if (!mapping) {
        return { success: false, error: `Unknown fix pattern: ${fixPattern}` };
      }

      const outcome = await withShadowWorktree(
        ctx,
        'fix',
        existingId,
        async ({ path, id, isNew }) => {
          // Apply the codemod
          const codemodResult = await shadowManager.applyCodemodInWorktree(
            path,
            mapping.pattern,
            mapping.replacement,
            targetFiles || [],
            mapping.lang
          );

          if (!codemodResult.success || codemodResult.matches === 0) {
            return { success: false, error: 'No matches found for fix pattern', codemodResult };
          }

          // Run tests to validate fix
          const testResult = await shadowManager.runTestsInWorktree(path);
          if (!testResult.success) {
            return { success: false, error: 'Fix broke tests', testResult, codemodResult };
          }

          const diff = await shadowManager.getDiff(path);

          // Request approval
          if (deps.approvalManager) {
            const req = deps.approvalManager.createRequest(
              `Apply fix: ${fixPattern} for test ${testName ?? 'unknown'}`,
              { diff, fixPattern, testName, codemodResult }
            );
            const approval = await req.result;
            if (!approval.approved) {
              return { success: false, error: 'Approval denied', reason: approval.reason };
            }
          }

          await shadowManager.mergeWorktree(id);

          // Stimulate competence drive
          nar.getExecution?.()?.stimulateDrives?.('test_passed');

          return {
            success: true,
            fixPattern,
            diff,
            testResult,
            message: 'Fix applied and validated',
            worktreeId: isNew ? id : existingId,
          };
        }
      );

      return toToolResult(outcome);
    },
  });
};
