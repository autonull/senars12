import { tool } from 'ai';
import { z } from 'zod';
import { type SelfToolsContext, writeAndValidate } from './context.js';

export const registerRuleTool = (ctx: SelfToolsContext) => {
  const { deps } = ctx;
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

      // If ruleCode provided, validate it (in shadow context only)
      if (ruleCode) {
        const outcome = await writeAndValidate(ctx, 'rule', existingId, {
          file: `rules/${ruleId}.ts`,
          contents: ruleCode,
          validationError: 'Rule validation failed',
        });
        if (!outcome.success) return outcome;

        return {
          success: true,
          ruleId,
          diff: outcome.diff,
          message: 'Rule registered and validated',
          worktreeId: outcome.worktreeId,
        };
      }

      return {
        success: false,
        error: `not-supported: schema-to-rule compilation (${ruleId}) is not implemented; rule was not registered`,
        ruleId,
      };
    },
  });
};
