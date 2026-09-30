import { stopwatch } from '@senars/util';
import { tool } from 'ai';
import { z } from 'zod';
import { runProcess } from '../proc.js';
import { SCENARIO_PROFILES } from '../scenario-profiles.js';
import { parseVitestJson } from '../vitest-json.js';
import { type SelfToolsContext, toToolResult, withShadowWorktree } from './context.js';

export const runTestsShadowTool = (ctx: SelfToolsContext) =>
  tool({
    description: 'Run tests in a shadow worktree for validation without affecting main branch.',
    inputSchema: z.strictObject({
      testPath: z.string().optional().describe('Specific test file or directory'),
      worktreeId: z.string().optional().describe('Existing worktree ID to use'),
    }),
    execute: async ({ testPath, worktreeId: existingId }) =>
      toToolResult(
        await withShadowWorktree(ctx, 'test', existingId, async ({ path }) => {
          const args = ['vitest', 'run', '--reporter=json'];
          if (testPath) args.push(testPath);

          const elapsed = stopwatch();
          const { code, stdout } = await runProcess('pnpm', args, { cwd: path });
          const parsed = parseVitestJson(stdout);
          return {
            success: parsed ? Boolean(parsed.success) : code === 0,
            passed: parsed?.numPassedTests ?? 0,
            failed: parsed?.numFailedTests ?? 0,
            total: parsed?.numTotalTests ?? 0,
            duration: elapsed(),
          };
        })
      ),
  });

export const runScenarioShadowTool = ({ deps }: SelfToolsContext) =>
  tool({
    description: 'Run a cognitive scenario in a shadow worktree for validation.',
    inputSchema: z.strictObject({
      seed: z.string().describe('Scenario seed/intent'),
      profile: z.enum(SCENARIO_PROFILES).optional().default('auto'),
      worktreeId: z.string().optional().describe('Existing worktree ID to use'),
    }),
    execute: async ({ seed, profile }) => {
      if (!deps.nar) {
        return { success: false, error: 'NAR not available' };
      }
      // D6 honesty: seeded/profiled scenario execution is not implemented —
      // no simulated success with ignored seed/profile.
      return {
        success: false,
        error: `not-supported: seeded/profiled scenario execution (seed=${seed}, profile=${profile}) is not implemented`,
      };
    },
  });
