import { safeRatio } from '@senars/util';
import { tool } from 'ai';
import { z } from 'zod';
import { applyAndValidate, type SelfToolsContext } from './context.js';

export const tuneKnobTool = (ctx: SelfToolsContext) => {
  const { deps } = ctx;
  return tool({
    description:
      'Tune a cognitive knob via RLFP. Applies tuning update and validates with tests. Supports worktree reuse.',
    inputSchema: z.strictObject({
      knob: z.string().describe('Knob to tune (e.g., "maxDerivationsPerStep")'),
      value: z.number().describe('New value for the knob'),
      reason: z.string().optional().describe('Reason for tuning'),
      worktreeId: z.string().optional().describe('Existing worktree ID to reuse'),
    }),
    execute: async ({ knob, value, worktreeId: existingId }) => {
      const { rlfpLearner, nar } = deps;
      if (!rlfpLearner || !nar) {
        return { success: false, error: 'RLFP learner or NAR not available' };
      }

      const previous = (rlfpLearner.getTunableKnobs() as Record<string, { current: number }>)[knob]
        ?.current;
      const set = (next: number) => rlfpLearner.applyTuningUpdate(knob, next);

      return applyAndValidate(
        ctx,
        'tune',
        existingId,
        'Tuning broke tests',
        () => set(value),
        () => {
          if (previous !== undefined) set(previous);
        },
        async ({ id }, testResult) => {
          // Record reward (TaskOutcome shape → intrinsic+extrinsic) with CI metrics
          const reward = rlfpLearner.calculateRewardFromTask({
            taskType: 'knob_tune',
            success: true,
            metrics: {
              passRate: safeRatio(testResult.passed, testResult.total),
              avgTestDuration: 0,
              coverageDelta: 0,
              memoryOverage: 0,
              cpuThrottleTime: 0,
              typecheckPassed: testResult.typecheckPassed ? 1 : 0,
              lintPassed: testResult.lintPassed ? 1 : 0,
            },
          });
          rlfpLearner.reward(reward, `knob_tune:${knob}`);

          nar.getExecution?.()?.stimulateDrives?.('knob_tuned');

          return {
            success: true,
            knob,
            value,
            reward,
            testResult,
            message: 'Knob tuned and validated',
            worktreeId: id,
          };
        }
      );
    },
  });
};
