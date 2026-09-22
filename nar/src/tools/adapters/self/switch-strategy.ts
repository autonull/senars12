import { tool } from 'ai';
import { z } from 'zod';
import type { SelfToolsContext } from './context.js';

export const switchStrategyTool = ({ deps, shadowManager, worktreeId }: SelfToolsContext) =>
  tool({
    description:
      'Switch cognitive strategy (sampling, derivation, attention, etc.). Validates with test run. Supports worktree reuse.',
    inputSchema: z.object({
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
      if (!deps.cognitiveController || !deps.nar) {
        return { success: false, error: 'CognitiveController or NAR not available' };
      }

      const strategyTypeKey =
        strategyType === 'lmRule'
          ? 'lm-rule'
          : (strategyType as 'sampling' | 'derivation' | 'attention' | 'premise');
      const registry = deps.cognitiveController.getRegistry();
      if (!registry.has(strategyTypeKey, strategy)) {
        return { success: false, error: `Strategy not found: ${strategy} (${strategyType})` };
      }

      // Save previous strategy for rollback
      const previousStrategy = deps.cognitiveController.getStrategy(strategyTypeKey);

      // Apply strategy
      deps.cognitiveController.setStrategy(strategyTypeKey, strategy);

      let worktreePath: string;
      let created = false;
      const wtId = existingId || `${worktreeId}-strategy`;

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

        // Validate with quick test run
        const testResult = await shadowManager.runTestsInWorktree(worktreePath);

        if (!testResult.success) {
          // Rollback: revert to previous strategy
          if (previousStrategy) {
            deps.cognitiveController.setStrategy(strategyTypeKey, previousStrategy);
          }
          return { success: false, error: 'Strategy switch broke tests', testResult };
        }

        // Stimulate competence drive
        deps.nar.getExecution?.()?.stimulateDrives?.('knob_tuned');

        return {
          success: true,
          strategy,
          strategyType,
          testResult,
          message: 'Strategy switched and validated',
          worktreeId: created ? wtId : existingId,
        };
      } catch (error) {
        // Rollback on error
        if (previousStrategy) {
          deps.cognitiveController.setStrategy(strategyTypeKey, previousStrategy);
        }
        return { success: false, error: String(error) };
      } finally {
        if (created) {
          await shadowManager.cleanupWorktree(wtId);
        }
      }
    },
  });
