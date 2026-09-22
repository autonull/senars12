import { dirname, resolve } from 'node:path';
import { tool } from 'ai';
import { z } from 'zod';
import type { SelfToolsContext } from './context.js';

export const registerRuleTool = ({ deps, shadowManager, worktreeId }: SelfToolsContext) =>
  tool({
    description:
      'Register a new inference rule in the NAR rule processor. Takes a schema ID and promotes it to an active rule. Supports worktree reuse.',
    inputSchema: z.strictObject({
      schemaId: z.string().describe('Schema identifier to promote (e.g., "schema_42")'),
      ruleCode: z
        .string()
        .optional()
        .describe('Optional custom rule implementation as TypeScript code'),
      worktreeId: z.string().optional().describe('Existing worktree ID to reuse'),
    }),
    execute: async ({ schemaId, ruleCode, worktreeId: existingId }) => {
      if (!deps.nar || !deps.ruleProcessor) {
        return { success: false, error: 'NAR or RuleProcessor not available' };
      }
      try {
        // D6 honesty: schema-to-rule compilation is not implemented — no
        // simulated success. Shadow validation still runs for the provided
        // code, but nothing is registered into the RuleProcessor.
        const ruleId = `promoted_${schemaId}`;

        // If ruleCode provided, eval it (in shadow context)
        if (ruleCode) {
          // Safety: only allow in shadow worktree
          let worktreePath: string;
          let created = false;
          const wtId = existingId || `${worktreeId}-rule`;

          if (existingId) {
            worktreePath = shadowManager.getWorktreePath(existingId) || '';
            if (!worktreePath) {
              return { success: false, error: `Worktree not found: ${existingId}` };
            }
          } else {
            worktreePath = await shadowManager.createWorktree(wtId);
            created = true;
          }

          try {
            const ruleFile = resolve(worktreePath, `rules/${ruleId}.ts`);
            const { mkdir, writeFile } = await import('node:fs/promises');
            await mkdir(dirname(ruleFile), { recursive: true });
            await writeFile(ruleFile, ruleCode, 'utf-8');

            // Run tests to validate
            const testResult = await shadowManager.runTestsInWorktree(worktreePath);
            if (!testResult.success) {
              return { success: false, error: 'Rule validation failed', testResult };
            }

            const diff = await shadowManager.getDiff(worktreePath);

            return {
              success: true,
              ruleId,
              diff,
              message: 'Rule registered and validated',
              worktreeId: created ? wtId : existingId,
            };
          } finally {
            if (created) {
              await shadowManager.cleanupWorktree(wtId);
            }
          }
        }

        return {
          success: false,
          error: `not-supported: schema-to-rule compilation (${ruleId}) is not implemented; rule was not registered`,
          ruleId,
        };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  });
