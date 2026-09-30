import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tool } from 'ai';
import { z } from 'zod';
import { ensureParentDir } from '@senars/util';
import { type SelfToolsContext, toToolResult, withShadowWorktree } from './context.js';

export const registerToolTool = (ctx: SelfToolsContext) => {
  const { deps, shadowManager } = ctx;
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
      const outcome = await withShadowWorktree(
        ctx,
        'tool',
        existingId,
        async ({ path, id, isNew }) => {
          const toolFile = resolve(path, `tools/${toolName}.ts`);
          await ensureParentDir(toolFile);
          await writeFile(toolFile, toolCode, 'utf-8');

          const testResult = await shadowManager.runTestsInWorktree(path);
          if (!testResult.success) {
            return { success: false, error: 'Tool validation failed', testResult };
          }

          const diff = await shadowManager.getDiff(path);

          // D6 honesty: shadow-validated code is not compiled or registered
          // with the ToolManager — report validation, not registration.
          return {
            success: false,
            error:
              'not-supported: shadow-validated tool code was not registered (compilation step not implemented)',
            toolName,
            diff,
            worktreeId: isNew ? id : existingId,
          };
        }
      );

      return toToolResult(outcome);
    },
  });
};
