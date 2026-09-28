import { tool } from 'ai';
import { z } from 'zod';
import { type SelfToolsContext, withShadowWorktree, toToolResult } from './context.js';

export const tuneKnobTool = (ctx: SelfToolsContext) => {
  const { deps, shadowManager } = ctx;
  return tool({
    description:
      'Tune a cognitive knob via RLFP. Applies tuning update and validates with tests. Supports worktree reuse.',
    inputSchema: z.strictObject({
      knob: z.string().describe('Knob to tune (e.g., "maxDerivationsPerStep")'),
      value: z.number().describe('New value for the knob'),
      reason: z.string().optional().describe('Reason for tuning'),
      worktreeId: z.string().optional().describe('Existing worktree ID to reuse'),
    }),
    execute: async ({ knob, value, reason, worktreeId: existingId }) => {
      const { rlfpLearner, nar } = deps;
      if (!rlfpLearner || !nar) {
        return { success: false, error: 'RLFP learner or NAR not available' };
      }

      // Get current knob value for potential rollback
      const knobs = rlfpLearner.getTunableKnobs();
      const previousValue = (knobs as Record<string, { current: number }>)[knob]?.current;

      // Apply tuning update
      rlfpLearner.applyTuningUpdate(knob, value);

      const revert = () => {
        if (previousValue !== undefined) rlfpLearner.applyTuningUpdate(knob, previousValue);
      };

      const outcome = await withShadowWorktree(
        ctx,
        'tune',
        existingId,
        async ({ path, id, isNew }) => {
          // Validate with quick test run in shadow worktree
          const testResult = await shadowManager.runTestsInWorktree(path);

          if (!testResult.success) {
            revert();
            return { success: false, error: 'Tuning broke tests', testResult };
          }

          // Record reward (TaskOutcome shape → intrinsic+extrinsic) with CI metrics
          const reward = rlfpLearner.calculateRewardFromTask({
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
          rlfpLearner.reward(reward, `knob_tune:${knob}`);

          // Stimulate competence drive
          nar.getExecution?.()?.stimulateDrives?.('knob_tuned');

          return {
            success: true,
            knob,
            value,
            reward,
            testResult,
            message: 'Knob tuned and validated',
            worktreeId: isNew ? id : existingId,
          };
        },
        revert
      );

      return toToolResult(outcome);
    },
  });
};
