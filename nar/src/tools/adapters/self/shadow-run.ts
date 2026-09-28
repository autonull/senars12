import { tool } from 'ai';
import { z } from 'zod';
import { runProcess } from '../proc.js';
import { parseVitestJson } from '../vitest-json.js';
import type { SelfToolsContext } from './context.js';

export const runTestsShadowTool = ({ shadowManager, worktreeId }: SelfToolsContext) =>
  tool({
    description: 'Run tests in a shadow worktree for validation without affecting main branch.',
    inputSchema: z.strictObject({
      testPath: z.string().optional().describe('Specific test file or directory'),
      worktreeId: z.string().optional().describe('Existing worktree ID to use'),
    }),
    execute: async ({ testPath, worktreeId: existingId }) => {
      try {
        let worktreePath: string;
        let created = false;

        if (existingId) {
          worktreePath = shadowManager.getWorktreePath(existingId) || '';
          if (!worktreePath) {
            return { success: false, error: `Worktree not found: ${existingId}` };
          }
        } else {
          worktreePath = await shadowManager.createWorktree(`${worktreeId}-test`);
          created = true;
        }

        const args = ['vitest', 'run', '--reporter=json'];
        if (testPath) args.push(testPath);

        const startedAt = Date.now();
        const { code, stdout } = await runProcess('pnpm', args, { cwd: worktreePath });
        const parsed = parseVitestJson(stdout);
        const result = {
          success: parsed ? Boolean(parsed.success) : code === 0,
          passed: parsed?.numPassedTests ?? 0,
          failed: parsed?.numFailedTests ?? 0,
          total: parsed?.numTotalTests ?? 0,
          duration: Date.now() - startedAt,
        };

        if (created) {
          await shadowManager.cleanupWorktree(`${worktreeId}-test`);
        }

        return result;
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  });

export const runScenarioShadowTool = ({ deps }: SelfToolsContext) =>
  tool({
    description: 'Run a cognitive scenario in a shadow worktree for validation.',
    inputSchema: z.strictObject({
      seed: z.string().describe('Scenario seed/intent'),
      profile: z
        .enum([
          'contradictory_sensors',
          'temporal_reasoning',
          'resource_pressure',
          'belief_revision',
          'cross_engine_sync',
          'auto',
        ])
        .optional()
        .default('auto'),
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
