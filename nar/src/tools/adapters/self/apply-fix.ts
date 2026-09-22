import { tool } from 'ai';
import { z } from 'zod';
import type { SelfToolsContext } from './context.js';

export const applyFixTool = ({ deps, shadowManager, worktreeId }: SelfToolsContext) =>
  tool({
    description:
      'Apply a semantic fix pattern to fix a test failure. Uses fix_pattern concepts mapped to codemod patterns. Executes in shadow worktree with test validation. Supports worktree reuse.',
    inputSchema: z.strictObject({
      fixPattern: z.string().describe('Fix pattern concept (e.g., "fix_pattern:null_check")'),
      targetFiles: z.array(z.string()).optional().describe('Specific files to apply fix to'),
      testName: z.string().optional().describe('Test that failed (for context)'),
      worktreeId: z.string().optional().describe('Existing worktree ID to reuse'),
    }),
    execute: async ({ fixPattern, targetFiles, testName, worktreeId: existingId }) => {
      if (!deps.nar) {
        return { success: false, error: 'NAR not available' };
      }

      const { getFixPatternMapping } = await import('../../self-concept.js');
      const mapping = getFixPatternMapping(fixPattern);
      if (!mapping) {
        return { success: false, error: `Unknown fix pattern: ${fixPattern}` };
      }

      let worktreePath: string;
      let created = false;
      const wtId = existingId || `${worktreeId}-fix`;

      try {
        if (existingId) {
          worktreePath = shadowManager.getWorktreePath(existingId) || '';
          if (!worktreePath) {
            return { success: false, error: `Worktree not found: ${existingId}` };
          }
        } else {
          worktreePath = await shadowManager.createWorktree(wtId);
          created = true;
        }

        // Apply the codemod
        const codemodResult = await shadowManager.applyCodemodInWorktree(
          worktreePath,
          mapping.pattern,
          mapping.replacement,
          targetFiles || [],
          mapping.lang
        );

        if (!codemodResult.success || codemodResult.matches === 0) {
          return { success: false, error: 'No matches found for fix pattern', codemodResult };
        }

        // Run tests to validate fix
        const testResult = await shadowManager.runTestsInWorktree(worktreePath);
        if (!testResult.success) {
          return { success: false, error: 'Fix broke tests', testResult, codemodResult };
        }

        const diff = await shadowManager.getDiff(worktreePath);

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

        await shadowManager.mergeWorktree(wtId);

        // Stimulate competence drive
        deps.nar.getExecution?.()?.stimulateDrives?.('test_passed');

        return {
          success: true,
          fixPattern,
          diff,
          testResult,
          message: 'Fix applied and validated',
          worktreeId: created ? wtId : existingId,
        };
      } catch (error) {
        return { success: false, error: String(error) };
      } finally {
        if (created) {
          await shadowManager.cleanupWorktree(wtId);
        }
      }
    },
  });
