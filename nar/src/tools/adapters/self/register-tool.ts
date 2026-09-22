import { dirname, resolve } from 'node:path';
import { tool } from 'ai';
import { z } from 'zod';
import type { SelfToolsContext } from './context.js';

export const registerToolTool = ({ deps, shadowManager, worktreeId }: SelfToolsContext) =>
  tool({
    description:
      'Register a new tool in the ToolManager. Tool implementation is validated in shadow worktree. Supports worktree reuse.',
    inputSchema: z.object({
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
      try {
        // Validate tool code in shadow worktree
        let worktreePath: string;
        let created = false;
        const wtId = existingId || `${worktreeId}-tool`;

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
          const toolFile = resolve(worktreePath, `tools/${toolName}.ts`);
          const { mkdir, writeFile } = await import('node:fs/promises');
          await mkdir(dirname(toolFile), { recursive: true });
          await writeFile(toolFile, toolCode, 'utf-8');

          const testResult = await shadowManager.runTestsInWorktree(worktreePath);
          if (!testResult.success) {
            return { success: false, error: 'Tool validation failed', testResult };
          }

          const diff = await shadowManager.getDiff(worktreePath);

          // D6 honesty: shadow-validated code is not compiled or registered
          // with the ToolManager — report validation, not registration.
          return {
            success: false,
            error:
              'not-supported: shadow-validated tool code was not registered (compilation step not implemented)',
            toolName,
            diff,
            worktreeId: created ? wtId : existingId,
          };
        } finally {
          if (created) {
            await shadowManager.cleanupWorktree(wtId);
          }
        }
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  });
