import { tool } from 'ai';
import { z } from 'zod';
import type { SelfToolsContext } from './context.js';

export const tuneKnobTool = ({ deps, shadowManager, worktreeId }: SelfToolsContext) =>
  tool({
    description:
      'Tune a cognitive knob via RLFP. Applies tuning update and validates with tests. Supports worktree reuse.',
    inputSchema: z.object({
      knob: z.string().describe('Knob to tune (e.g., "maxDerivationsPerStep")'),
      value: z.number().describe('New value for the knob'),
      reason: z.string().optional().describe('Reason for tuning'),
      worktreeId: z.string().optional().describe('Existing worktree ID to reuse'),
    }),
    execute: async ({ knob, value, reason, worktreeId: existingId }) => {
      if (!deps.rlfpLearner || !deps.nar) {
        return { success: false, error: 'RLFP learner or NAR not available' };
      }

      // Get current knob value for potential rollback
      const knobs = deps.rlfpLearner.getTunableKnobs();
      const previousValue = (knobs as Record<string, { current: number }>)[knob]?.current;

      // Apply tuning update
      deps.rlfpLearner.applyTuningUpdate(knob, value);

      let worktreePath: string;
      let created = false;
      const wtId = existingId || `${worktreeId}-tune`;

      try {
        if (existingId) {
          worktreePath = shadowManager.getWorktreePath(existingId) || '';
          if (!worktreePath) {
            return { success: false, error: `Worktree not found: ${existingId}` };
          }
        } else {
          worktreePath = await shadowManager.createWorktree(wtId);
          created = true;
        }

        // Validate with quick test run in shadow worktree
        const testResult = await shadowManager.runTestsInWorktree(worktreePath);

        if (!testResult.success) {
          // Revert on failure
          if (previousValue !== undefined) {
            deps.rlfpLearner.applyTuningUpdate(knob, previousValue);
          }
          return { success: false, error: 'Tuning broke tests', testResult };
        }

        // Record reward (TaskOutcome shape → intrinsic+extrinsic) with CI metrics
        const reward = deps.rlfpLearner.calculateRewardFromTask({
          taskType: 'knob_tune',
          success: true,
          metrics: {
            passRate: testResult.total > 0 ? testResult.passed / testResult.total : 0,
            avgTestDuration: 0,
            coverageDelta: 0,
            memoryOverage: 0,
            cpuThrottleTime: 0,
            typecheckPassed: testResult.typecheckPassed ? 1 : 0,
            lintPassed: testResult.lintPassed ? 1 : 0,
          },
        });
        deps.rlfpLearner.reward(reward, `knob_tune:${knob}`);

        // Stimulate competence drive
        deps.nar.getExecution?.()?.stimulateDrives?.('knob_tuned');

        return {
          success: true,
          knob,
          value,
          reward,
          testResult,
          message: 'Knob tuned and validated',
          worktreeId: created ? wtId : existingId,
        };
      } catch (error) {
        // Rollback on error
        if (previousValue !== undefined) {
          deps.rlfpLearner.applyTuningUpdate(knob, previousValue);
        }
        return { success: false, error: String(error) };
      } finally {
        if (created) {
          await shadowManager.cleanupWorktree(wtId);
        }
      }
    },
  });
