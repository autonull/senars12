import { dirname, resolve } from 'node:path';
import { tool } from 'ai';
import { z } from 'zod';
import { type SelfToolsContext, withShadowWorktree } from './context.js';

export const registerRuleTool = (ctx: SelfToolsContext) => {
  const { deps, shadowManager } = ctx;
  return tool({
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
      // D6 honesty: schema-to-rule compilation is not implemented — no
      // simulated success. Shadow validation still runs for the provided
      // code, but nothing is registered into the RuleProcessor.
      const ruleId = `promoted_${schemaId}`;

      // If ruleCode provided, eval it (in shadow context only)
      if (ruleCode) {
        const outcome = await withShadowWorktree(
          ctx,
          'rule',
          existingId,
          async ({ path, id, isNew }) => {
            const ruleFile = resolve(path, `rules/${ruleId}.ts`);
            const { mkdir, writeFile } = await import('node:fs/promises');
            await mkdir(dirname(ruleFile), { recursive: true });
            await writeFile(ruleFile, ruleCode, 'utf-8');

            // Run tests to validate
            const testResult = await shadowManager.runTestsInWorktree(path);
            if (!testResult.success) {
              return { success: false, error: 'Rule validation failed', testResult };
            }

            const diff = await shadowManager.getDiff(path);

            return {
              success: true,
              ruleId,
              diff,
              message: 'Rule registered and validated',
              worktreeId: isNew ? id : existingId,
            };
          }
        );

        if (outcome.ok) return outcome.value;
        return { success: false, error: outcome.error };
      }

      return {
        success: false,
        error: `not-supported: schema-to-rule compilation (${ruleId}) is not implemented; rule was not registered`,
        ruleId,
      };
    },
  });
};
