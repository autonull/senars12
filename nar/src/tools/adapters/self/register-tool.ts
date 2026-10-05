import { tool } from 'ai';
import { z } from 'zod';
import { type SelfToolsContext, writeAndValidate } from './context.js';

export const registerToolTool = (ctx: SelfToolsContext) => {
  const { deps } = ctx;
  return tool({
    description:
      'Register a new tool in the ToolManager. Tool implementation is validated in shadow worktree. Supports worktree reuse.',
    inputSchema: z.strictObject({
      toolName: z.string().describe('Name of the tool to register'),
      toolCode: z.string().describe('Tool implementation as TypeScript code'),
      schema: z.record(z.string(), z.unknown()).describe('JSON Schema for tool input'),
      description: z.string().describe('Tool description'),
      worktreeId: z.string().optional().describe('Existing worktree ID to reuse'),
    }),
    execute: async ({ toolName, toolCode, schema, description, worktreeId: existingId }) => {
      if (!deps.nar || !deps.toolManager) {
        return { success: false, error: 'NAR or ToolManager not available' };
      }
      const outcome = await writeAndValidate(ctx, 'tool', existingId, {
        file: `tools/${toolName}.ts`,
        contents: toolCode,
        validationError: 'Tool validation failed',
      });
      if (!outcome.success) return outcome;

      // D6 honesty: shadow-validated code is not compiled or registered
      // with the ToolManager — report validation, not registration.
      return {
        success: false,
        error:
          'not-supported: shadow-validated tool code was not registered (compilation step not implemented)',
        toolName,
        diff: outcome.diff,
        worktreeId: outcome.worktreeId,
      };
    },
  });
};
