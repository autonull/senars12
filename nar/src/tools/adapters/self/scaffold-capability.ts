import { dirname, resolve } from 'node:path';
import { tool } from 'ai';
import { z } from 'zod';
import { type SelfToolsContext, toToolResult, withShadowWorktree } from './context.js';

export const scaffoldCapabilityTool = (ctx: SelfToolsContext) => {
  const { deps, shadowManager } = ctx;
  return tool({
    description:
      'Scaffold a new capability from a template. Generates code in shadow worktree, runs tests, requires approval. Supports worktree reuse.',
    inputSchema: z.strictObject({
      capabilityId: z.string().describe('Capability identifier (e.g., "web_search")'),
      templateId: z.string().describe('Template to use (e.g., "tool_template", "rule_template")'),
      parameters: z.record(z.string(), z.unknown()).optional().describe('Template parameters'),
      worktreeId: z.string().optional().describe('Existing worktree ID to reuse'),
    }),
    execute: async ({ capabilityId, templateId, parameters = {}, worktreeId: existingId }) => {
      if (!deps.nar) {
        return { success: false, error: 'NAR not available' };
      }

      const outcome = await withShadowWorktree(
        ctx,
        'scaffold',
        existingId,
        async ({ path, id, isNew }) => {
          // Template implementations
          const templates: Record<string, string> = {
            tool_template: `
import { tool } from 'ai';
import { z } from 'zod';

export const ${capabilityId} = tool({
  description: '${parameters.description ?? `Auto-generated ${capabilityId} tool`}',
  inputSchema: z.strictObject({
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
          const capFile = resolve(path, `capabilities/${capabilityId}${ext}`);
          await ensureParentDir(capFile);
          await writeFile(capFile, template ?? '', 'utf-8');

          const testResult = await shadowManager.runTestsInWorktree(path);
          if (!testResult.success) {
            return { success: false, error: 'Capability validation failed', testResult };
          }

          const diff = await shadowManager.getDiff(path);

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

          await shadowManager.mergeWorktree(id);
          return {
            success: true,
            capabilityId,
            diff,
            message: 'Capability scaffolded and merged',
            worktreeId: isNew ? id : existingId,
          };
        }
      );

      return toToolResult(outcome);
    },
  });
};

import { ensureParentDir } from '../../../utils/fs.js';
