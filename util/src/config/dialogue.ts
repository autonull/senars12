/**
 * Dialogue Flywheel config (TODO24). Top-level app section — dialogue is a
 * peer subsystem that optional reasoners (System One) feed into, not a child
 * of one. Disabled by default: with `enabled: false` the bot behaves
 * byte-identically to pre-flywheel behavior (I5).
 */
import { z } from 'zod';

export const dialogueDefaults = {
  enabled: false,
  captureAll: false,
  maxTurnsPerSession: 500,
  /** Opt-in (DQ3): run a retrospective on session close. */
  autoRetrospect: false,
  /** I6 scope: raw-text sidecar off by default (hash-only episodes/labels). */
  retention: 'hash-only' as const,
  /** Sidecar dir for raw text when retention === 'with-text'. */
  textStorePath: './.cache/dialogue/text',
} as const;

export const dialogueSchema = z.object({
  enabled: z.boolean().default(dialogueDefaults.enabled),
  /** Capture every turn vs. grade-sampled + reacted turns only. */
  captureAll: z.boolean().default(dialogueDefaults.captureAll),
  /** Bounded per AIKR. */
  maxTurnsPerSession: z.number().int().positive().default(dialogueDefaults.maxTurnsPerSession),
  autoRetrospect: z.boolean().default(dialogueDefaults.autoRetrospect),
  /** I6 relaxation: persist raw exchange text in a dedicated sidecar. Labels and
   *  retrospectives stay hash-only regardless. */
  retention: z.enum(['hash-only', 'with-text']).default(dialogueDefaults.retention),
  textStorePath: z.string().default(dialogueDefaults.textStorePath),
});

export type DialogueConfig = z.infer<typeof dialogueSchema>;