import { spawn } from 'node:child_process';
import { tool } from 'ai';
import { z } from 'zod';
import type { SelfToolsContext } from './context.js';

export const runTestsShadowTool = ({ shadowManager, worktreeId }: SelfToolsContext) =>
  tool({
    description: 'Run tests in a shadow worktree for validation without affecting main branch.',
    inputSchema: z.object({
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

        const result = await new Promise<{
          success: boolean;
          passed: number;
          failed: number;
          total: number;
          duration: number;
        }>((resolve) => {
          const child = spawn('pnpm', args, {
            cwd: worktreePath,
            stdio: ['pipe', 'pipe', 'pipe'],
          });

          let stdout = '';
          const startTime = Date.now();

          child.stdout?.on('data', (data: Buffer) => {
            stdout += data.toString();
          });

          child.on('close', (code) => {
            try {
              const lines = stdout.trim().split('\n');
              let jsonStart = -1;
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line?.trim().startsWith('{')) {
                  jsonStart = i;
                  break;
                }
              }
              if (jsonStart >= 0) {
                const data = JSON.parse(lines.slice(jsonStart).join('\n'));
                resolve({
                  success: data.success,
                  passed: data.numPassedTests ?? 0,
                  failed: data.numFailedTests ?? 0,
                  total: data.numTotalTests ?? 0,
                  duration: Date.now() - startTime,
                });
              } else {
                resolve({
                  success: code === 0,
                  passed: 0,
                  failed: 0,
                  total: 0,
                  duration: Date.now() - startTime,
                });
              }
            } catch {
              resolve({
                success: code === 0,
                passed: 0,
                failed: 0,
                total: 0,
                duration: Date.now() - startTime,
              });
            }
          });

          child.on('error', () =>
            resolve({
              success: false,
              passed: 0,
              failed: 0,
              total: 0,
              duration: Date.now() - startTime,
            })
          );
        });

        if (created) {
          await shadowManager.cleanupWorktree(`${worktreeId}-test`);
        }

        return { ...result, success: result.success };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  });

export const runScenarioShadowTool = ({ deps }: SelfToolsContext) =>
  tool({
    description: 'Run a cognitive scenario in a shadow worktree for validation.',
    inputSchema: z.object({
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
