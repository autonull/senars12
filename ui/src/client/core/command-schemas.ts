/**
 * Zod schemas for command arguments (§P3.1/P3.2).
 * Provides type-safe validation for `ui.command` round-trip.
 */

import { z } from 'zod';

/** Base schema for all command args. */
export const CommandArgsSchema = z.record(z.string(), z.unknown());

/** Composer commands. */
export const ComposerFocusSchema = z.object({
  refs: z.array(z.string()).optional(),
  mode: z.enum(['ask', 'believe', 'goal', 'reason', 'plan', 'code', 'search', 'analyze']).optional(),
});

export const ComposerOpenSchema = z.object({
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  anchor: z.string().optional(),
});

/** Overlay commands. */
export const OverlayOpenSchema = z.object({
  id: z.string().optional(),
  ref: z.string().optional(),
  anchor: z.string().optional(),
});

export const OverlayCloseSchema = z.object({
  id: z.string().optional(),
});

export const OverlayPaletteSchema = z.object({});

export const OverlayPinSchema = z.object({
  id: z.string().optional(),
  pinned: z.boolean().optional(),
});

export const OverlayPinToggleSchema = z.object({});

export const OverlayMinimizeSchema = z.object({
  id: z.string(),
  minimize: z.boolean(),
});

export const OverlayMaximizeSchema = z.object({
  id: z.string(),
  maximize: z.boolean(),
});

export const OverlayCascadeSchema = z.object({
  offset: z.number().default(30),
});

export const OverlayTileSchema = z.object({});

/** View commands. */
export const ViewFitSchema = z.object({});

export const ViewMinimapSchema = z.object({});

export const ViewPanelSchema = z.object({
  id: z.string().optional(),
});

export const ViewFoldAllSchema = z.object({});

/** Reasoning commands. */
export const ReasoningSubmitSchema = z.object({
  term: z.string(),
  mode: z.enum(['belief', 'goal', 'question']).default('belief'),
});

export const ReasoningStepSchema = z.object({});

export const ReasoningRunSchema = z.object({});

export const ReasoningRetractSchema = z.object({
  nodeId: z.string(),
});

export const ReasoningReviseSchema = z.object({
  nodeId: z.string(),
  frequency: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
});

export const ReasoningAddGoalSchema = z.object({
  term: z.string(),
});

export const ReasoningAdjustBudgetSchema = z.object({
  budget: z.number().nonnegative(),
});

export const ReasoningAdjustProviderSchema = z.object({
  provider: z.string(),
});

/** Renderer commands. */
export const RendererSwitchSchema = z.object({
  id: z.string().optional(),
});

/** Map command ID to its Zod schema. */
export const COMMAND_SCHEMAS: Record<string, z.ZodSchema> = {
  'composer.focus': ComposerFocusSchema,
  'composer.open': ComposerOpenSchema,
  'composer.close': z.object({}),

  'overlay.palette': OverlayPaletteSchema,
  'overlay.open': OverlayOpenSchema,
  'overlay.close': OverlayCloseSchema,
  'overlay.pin': OverlayPinSchema,
  'overlay.pin-toggle': OverlayPinToggleSchema,
  'overlay.minimize': OverlayMinimizeSchema,
  'overlay.maximize': OverlayMaximizeSchema,
  'overlay.cascade': OverlayCascadeSchema,
  'overlay.tile': OverlayTileSchema,

  'view.fit': ViewFitSchema,
  'view.minimap': ViewMinimapSchema,
  'view.panel.search': ViewPanelSchema,
  'view.panel.chat': ViewPanelSchema,
  'view.panel.lens-designer': ViewPanelSchema,
  'view.fold-all': ViewFoldAllSchema,

  'reasoning.submit': ReasoningSubmitSchema,
  'reasoning.step': ReasoningStepSchema,
  'reasoning.run': ReasoningRunSchema,
  'reasoning.retract': ReasoningRetractSchema,
  'reasoning.revise': ReasoningReviseSchema,
  'reasoning.add-goal': ReasoningAddGoalSchema,
  'reasoning.adjust-budget': ReasoningAdjustBudgetSchema,
  'reasoning.adjust-provider': ReasoningAdjustProviderSchema,

  // Renderer switch commands (derived)
  'renderer.graph': RendererSwitchSchema,
  'renderer.notebook': RendererSwitchSchema,
};

/** Infer TypeScript type from a command schema. */
export type InferCommandArgs<T extends z.ZodSchema> = z.infer<T>;

/** Validate command args against schema. */
export function validateCommandArgs(commandId: string, args: unknown): { success: boolean; data?: unknown; error?: string } {
  const schema = COMMAND_SCHEMAS[commandId];
  if (!schema) {
    // No schema defined - allow through (backward compat)
    return { success: true, data: args };
  }
  const result = schema.safeParse(args);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    };
  }
  return { success: true, data: result.data };
}

/** Get schema for a command (for agent introspection). */
export function getCommandSchema(commandId: string): z.ZodSchema | undefined {
  return COMMAND_SCHEMAS[commandId];
}

/** Get all command schemas as JSON Schema (for agent tool definitions). */
export function getAllCommandSchemas(): Record<string, object> {
  // For now, return empty object - can be implemented with zod-to-json-schema later
  return {};
}