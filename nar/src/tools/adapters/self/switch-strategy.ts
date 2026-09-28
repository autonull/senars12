import { tool } from 'ai';
import { z } from 'zod';
import { type SelfToolsContext, applyAndValidate } from './context.js';

const STRATEGY_TYPES = ['sampling', 'derivation', 'attention', 'lmRule', 'premise'] as const;
const REGISTRY_KEYS = {
  sampling: 'sampling',
  derivation: 'derivation',
  attention: 'attention',
  lmRule: 'lm-rule',
  premise: 'premise',
} as const;

export const switchStrategyTool = (ctx: SelfToolsContext) => {
  const { deps } = ctx;
  return tool({
    description:
      'Switch cognitive strategy (sampling, derivation, attention, etc.). Validates with test run. Supports worktree reuse.',
    inputSchema: z.strictObject({
      strategy: z
        .string()
        .describe('Strategy to switch to (e.g., "focused", "exhaustive", "anytime")'),
      strategyType: z.enum(STRATEGY_TYPES).describe('Type of strategy'),
      reason: z.string().optional().describe('Reason for switch'),
      worktreeId: z.string().optional().describe('Existing worktree ID to reuse'),
    }),
    execute: async ({ strategy, strategyType, worktreeId: existingId }) => {
      const { cognitiveController: controller, nar } = deps;
      if (!controller || !nar) {
        return { success: false, error: 'CognitiveController or NAR not available' };
      }

      const key = REGISTRY_KEYS[strategyType];
      const registry = controller.getRegistry();
      if (!registry.has(key, strategy)) {
        return { success: false, error: `Strategy not found: ${strategy} (${strategyType})` };
      }

      const previous = controller.getStrategy(key);
      return applyAndValidate(
        ctx,
        'strategy',
        existingId,
        'Strategy switch broke tests',
        () => controller.setStrategy(key, strategy),
        () => {
          if (previous) controller.setStrategy(key, previous);
        },
        async ({ id }, testResult) => {
          nar.getExecution?.()?.stimulateDrives?.('knob_tuned');
          return {
            success: true,
            strategy,
            strategyType,
            testResult,
            message: 'Strategy switched and validated',
            worktreeId: existingId ?? id,
          };
        }
      );
    },
  });
};
