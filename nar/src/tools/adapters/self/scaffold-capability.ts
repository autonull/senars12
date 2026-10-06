import { tool } from 'ai';
import { z } from 'zod';
import { type SelfToolsContext, unavailable, writeAndValidate } from './context.js';

/** Template implementations a scaffolded capability can be generated from. */
const scaffoldTemplates = (
  capabilityId: string,
  parameters: Record<string, unknown>
): Record<string, string> => ({
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
});

export const scaffoldCapabilityTool = (ctx: SelfToolsContext) => {
  const { deps } = ctx;
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
      if (!deps.nar) return unavailable('NAR');

      const templates = scaffoldTemplates(capabilityId, parameters);
      const outcome = await writeAndValidate(ctx, 'scaffold', existingId, {
        file: `capabilities/${capabilityId}.ts`,
        contents: templates[templateId] || templates.tool_template || '',
        validationError: 'Capability validation failed',
        approval: `Add capability: ${capabilityId} from ${templateId}`,
        merge: true,
      });
      if (!outcome.success) return outcome;

      return {
        success: true,
        capabilityId,
        diff: outcome.diff,
        message: 'Capability scaffolded and merged',
        worktreeId: outcome.worktreeId,
      };
    },
  });
};
