import { tool } from 'ai';
import { z } from 'zod';
import { type SelfToolsContext, withShadowWorktree } from './context.js';

export const switchStrategyTool = (ctx: SelfToolsContext) => {
  const { deps, shadowManager } = ctx;
  return tool({
    description:
      'Switch cognitive strategy (sampling, derivation, attention, etc.). Validates with test run. Supports worktree reuse.',
    inputSchema: z.strictObject({
      strategy: z
        .string()
        .describe('Strategy to switch to (e.g., "focused", "exhaustive", "anytime")'),
      strategyType: z
        .enum(['sampling', 'derivation', 'attention', 'lmRule', 'premise'])
        .describe('Type of strategy'),
      reason: z.string().optional().describe('Reason for switch'),
      worktreeId: z.string().optional().describe('Existing worktree ID to reuse'),
    }),
    execute: async ({ strategy, strategyType, reason, worktreeId: existingId }) => {
      const { cognitiveController: controller, nar } = deps;
      if (!controller || !nar) {
        return { success: false, error: 'CognitiveController or NAR not available' };
      }

      const strategyTypeKey =
        strategyType === 'lmRule'
          ? 'lm-rule'
          : (strategyType as 'sampling' | 'derivation' | 'attention' | 'premise');
      const registry = controller.getRegistry();
      if (!registry.has(strategyTypeKey, strategy)) {
        return { success: false, error: `Strategy not found: ${strategy} (${strategyType})` };
      }

      // Save previous strategy for rollback
      const previousStrategy = controller.getStrategy(strategyTypeKey);

      // Apply strategy
      controller.setStrategy(strategyTypeKey, strategy);

      const revert = () => {
        if (previousStrategy) controller.setStrategy(strategyTypeKey, previousStrategy);
      };

      const outcome = await withShadowWorktree(
        ctx,
        'strategy',
        existingId,
        async ({ path, id, isNew }) => {
          // Validate with quick test run
          const testResult = await shadowManager.runTestsInWorktree(path);

          if (!testResult.success) {
            revert();
            return { success: false, error: 'Strategy switch broke tests', testResult };
          }

          // Stimulate competence drive
          nar.getExecution?.()?.stimulateDrives?.('knob_tuned');

          return {
            success: true,
            strategy,
            strategyType,
            testResult,
            message: 'Strategy switched and validated',
            worktreeId: isNew ? id : existingId,
          };
        },
        revert
      );

      return outcome.ok ? outcome.value : { success: false, error: outcome.error };
    },
  });
};
