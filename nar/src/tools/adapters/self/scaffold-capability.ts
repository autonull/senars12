import { dirname, resolve } from 'node:path';
import { tool } from 'ai';
import { z } from 'zod';
import type { SelfToolsContext } from './context.js';

export const scaffoldCapabilityTool = ({ deps, shadowManager, worktreeId }: SelfToolsContext) =>
  tool({
    description:
      'Scaffold a new capability from a template. Generates code in shadow worktree, runs tests, requires approval. Supports worktree reuse.',
    inputSchema: z.object({
      capabilityId: z.string().describe('Capability identifier (e.g., "web_search")'),
      templateId: z.string().describe('Template to use (e.g., "tool_template", "rule_template")'),
      parameters: z.record(z.string(), z.unknown()).optional().describe('Template parameters'),
      worktreeId: z.string().optional().describe('Existing worktree ID to reuse'),
    }),
    execute: async ({ capabilityId, templateId, parameters = {}, worktreeId: existingId }) => {
      if (!deps.nar) {
        return { success: false, error: 'NAR not available' };
      }

      let worktreePath: string;
      let created = false;
      const wtId = existingId || `${worktreeId}-scaffold`;

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
        // Template implementations
        const templates: Record<string, string> = {
          tool_template: `
import { tool } from 'ai';
import { z } from 'zod';

export const ${capabilityId} = tool({
  description: '${parameters.description ?? `Auto-generated ${capabilityId} tool`}',
  inputSchema: z.object({
    ${
      Object.entries(parameters)
        .map(([k, v]) => `${k}: z.${typeof v === 'string' ? 'string()' : 'unknown()'}`)
        .join(',\n    ') || 'input: z.string()'
    }
  }),
  execute: async (args) => {
    // TODO: Implement ${capabilityId}
    return { result: 'not implemented', args };
  },
});`,
          rule_template: `
import { TermBuilder, variable, atom } from '@senars/nar/terms';
import { Truth } from '@senars/nar/terms';
import type { RegisteredRule } from '@senars/nar/rules';

export const ${capabilityId}_rule: RegisteredRule = {
  id: '${capabilityId}_rule',
  pattern: { left: { op: 'implication' }, right: { op: 'implication' } },
  apply: (premises) => {
    // TODO: Implement ${capabilityId} rule logic
    return undefined;
  },
  sync: true,
  priority: 0.5,
  truthFn: () => Truth.create(0.7, 0.8),
};`,
        };

        const template = templates[templateId] || templates.tool_template;
        const { mkdir, writeFile } = await import('node:fs/promises');
        const ext = templateId.includes('rule') ? '.ts' : '.ts';
        const capFile = resolve(worktreePath, `capabilities/${capabilityId}${ext}`);
        await mkdir(dirname(capFile), { recursive: true });
        await writeFile(capFile, template ?? '', 'utf-8');

        const testResult = await shadowManager.runTestsInWorktree(worktreePath);
        if (!testResult.success) {
          return { success: false, error: 'Capability validation failed', testResult };
        }

        const diff = await shadowManager.getDiff(worktreePath);

        // Request approval if manager available
        if (deps.approvalManager) {
          const req = deps.approvalManager.createRequest(`Add capability: ${capabilityId}`, {
            diff,
            templateId,
            parameters,
          });
          const approval = await req.result;
          if (!approval.approved) {
            return { success: false, error: 'Approval denied', reason: approval.reason };
          }
        }

        await shadowManager.mergeWorktree(wtId);
        return {
          success: true,
          capabilityId,
          diff,
          message: 'Capability scaffolded and merged',
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
