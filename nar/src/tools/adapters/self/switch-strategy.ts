import { tool } from 'ai';
import { z } from 'zod';
import { STRATEGY_SLOTS, STRATEGY_SLOTS_BY_KEY } from '../../../config/cognitive-parameters.js';
import { type SelfToolsContext, applyAndValidate } from './context.js';

/** Slot keys are the config's own names, so the error names what the user wrote. */
const STRATEGY_TYPES = Object.keys(STRATEGY_SLOTS_BY_KEY) as [
  ...(keyof typeof STRATEGY_SLOTS_BY_KEY)[],
];
const slotSchema = z.enum(STRATEGY_TYPES);

export const switchStrategyTool = (ctx: SelfToolsContext) => {
  const { deps } = ctx;
  return tool({
    description:
      'Switch cognitive strategy (sampling, derivation, attention, etc.). Validates with test run. Supports worktree reuse.',
    inputSchema: z.strictObject({
      strategy: z
        .string()
        .describe('Strategy to switch to (e.g., "focused", "exhaustive", "anytime")'),
      strategyType: slotSchema.describe('Type of strategy'),
      reason: z.string().optional().describe('Reason for switch'),
      worktreeId: z.string().optional().describe('Existing worktree ID to reuse'),
    }),
    execute: async ({ strategy, strategyType, worktreeId: existingId }) => {
      const { cognitiveController: controller, nar } = deps;
      if (!controller || !nar) {
        return { success: false, error: 'CognitiveController or NAR not available' };
      }

      const slotType = STRATEGY_SLOTS_BY_KEY[strategyType];
      const registry = controller.getRegistry();
      const candidates = registry.list(slotType).map((r) => r.name);
      if (!candidates.includes(strategy)) {
        return {
          success: false,
          error: `No ${strategyType} strategy named '${strategy}' (available: ${candidates.join(', ') || 'none'})`,
        };
      }

      const previous = controller.getStrategy(slotType);
      return applyAndValidate(
        ctx,
        'strategy',
        existingId,
        'Strategy switch broke tests',
        () => controller.setStrategy(slotType, strategy),
        () => {
          if (previous) controller.setStrategy(slotType, previous);
        },
        async ({ id }, testResult) => {
          nar.getExecution?.()?.stimulateDrives?.('knob_tuned');
          return {
            success: true,
            strategy,
            strategyType,
            testResult,
            message: 'Strategy switched and validated',
            worktreeId: id,
          };
        }
      );
    },
  });
};
