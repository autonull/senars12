import { tool } from 'ai';
import { z } from 'zod';
import { STRATEGY_SLOTS } from '../../../config/cognitive-parameters.js';
import { type SelfToolsContext, applyAndValidate } from './context.js';

/** Slot keys are the config's own names, so the error names what the user wrote. */
const STRATEGY_TYPES = Object.keys(STRATEGY_SLOTS) as Array<keyof typeof STRATEGY_SLOTS>;
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

      const slot = STRATEGY_SLOTS[strategyType];
      const registry = controller.getRegistry();
      const candidates = registry.list(slot.type).map((r) => r.name);
      if (!candidates.includes(strategy)) {
        return {
          success: false,
          error: `No ${strategyType} strategy named '${strategy}' (available: ${candidates.join(', ') || 'none'})`,
        };
      }

      const previous = controller.getStrategy(slot.type);
      return applyAndValidate(
        ctx,
        'strategy',
        existingId,
        'Strategy switch broke tests',
        () => controller.setStrategy(slot.type, strategy),
        () => {
          if (previous) controller.setStrategy(slot.type, previous);
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
